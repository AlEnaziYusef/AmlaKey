/**
 * Ejar contract sync utilities.
 * Handles periodic re-sync of tenant contracts via REGA's public inquiry page.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { userKey, EJAR_SYNC_COOLDOWN_KEY } from "./storage";
import { getDuePeriodMonth } from "./dateUtils";

export const SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export const REGA_DETAIL_BASE =
  "https://rega.gov.sa/en/rega-services/real-estate-enquiries/result-page/%D8%AA%D9%81%D8%A7%D8%B5%D9%8A%D9%84-%D8%B9%D9%82%D8%AF-%D8%A7%D9%84%D8%A5%D9%8A%D8%AC%D8%A7%D8%B1/";

export interface EjarSyncTenant {
  id: string;
  national_id: string;
  contract_number: string;
  hijri_dob?: string;
  property_id: string | null;
  lease_start: string;
  monthly_rent: number;
  payment_frequency?: string;
  status: string;
  ejar_contract_status?: string | null;
  name?: string;
}

export interface EjarSyncResult {
  tenantId: string;
  tenantName?: string;
  statusChanged: boolean;
  newStatus?: string;
  newPayments: number;
  unpaidBills: number;
  error?: string;
}

/** Build the REGA detail URL for a tenant's contract. */
export function buildEjarSyncUrl(tenant: EjarSyncTenant): string {
  return `${REGA_DETAIL_BASE}?id_number=${tenant.national_id}&contract_number=${tenant.contract_number}&major_version=1&minor_version=0`;
}

/**
 * Enhanced extraction JS that also captures contractStatus and contractVersion.
 * Injected into the REGA detail page WebView.
 */
export const EJAR_EXTRACT_JS = `
(function() {
  try {
    var data = {};
    var allText = document.body.innerText || "";

    /* ── Contract status ── */
    var csM = allText.match(/Contract Status[\\s\\n]+(\\S+)/);
    if (csM) data.contractStatus = csM[1];
    if (!data.contractStatus) {
      var csAr = allText.match(/حالة العقد[\\s\\n]+([^\\n]+)/);
      if (csAr) data.contractStatus = csAr[1].trim();
    }

    /* ── Contract version ── */
    var cvM = allText.match(/نسخة العقد[\\s\\n]+([\\d.]+)/);
    if (cvM) data.contractVersion = cvM[1];

    /* ── Dates ── */
    var sdM = allText.match(/تاريخ العقد[\\s\\n]+(\\d{4}-\\d{2}-\\d{2})/);
    if (sdM) data.leaseStart = sdM[1];
    if (!data.leaseStart) {
      var idM = allText.match(/Issue Date[\\s\\n]+(\\d{4}-\\d{2}-\\d{2})/);
      if (idM) data.leaseStart = idM[1];
    }
    var edM = allText.match(/تاريخ نهاية العقد[\\s\\n]+(\\d{4}-\\d{2}-\\d{2})/);
    if (edM) data.leaseEnd = edM[1];

    /* ── Financial ── */
    var cards = document.querySelectorAll('.card-body, .card');
    cards.forEach(function(card) {
      var text = card.innerText || "";
      if (text.indexOf("المعلومات المالية") >= 0) {
        var amountM = text.match(/(\\d[\\d,.]+)\\s*ريال/);
        if (amountM) data.totalAmount = parseFloat(amountM[1].replace(/,/g, ""));
        if (text.indexOf("شهري") >= 0) data.paymentType = "monthly";
        else if (text.indexOf("ربع سنوي") >= 0) data.paymentType = "quarterly";
        else if (text.indexOf("نصف سنوي") >= 0) data.paymentType = "semi-annual";
        else data.paymentType = "annual";
      }
    });

    /* ── Bills ── */
    var billsM = allText.match(/الفواتير\\s*(\\d+)/);
    data.billCount = billsM ? parseInt(billsM[1]) : 0;
    var unpaidMatches = allText.match(/غير مدفوعة/g);
    data.unpaidBills = unpaidMatches ? unpaidMatches.length : 0;

    window.ReactNativeWebView.postMessage(JSON.stringify({ success: true, data: data }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.message }));
  }
})();
true;
`;

/**
 * Process a single tenant's Ejar sync result.
 * Updates contract status, inserts new payments, and records sync timestamp.
 */
export async function processEjarSyncResult(
  tenant: EjarSyncTenant,
  data: any,
): Promise<EjarSyncResult> {
  const result: EjarSyncResult = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    statusChanged: false,
    newPayments: 0,
    unpaidBills: data.unpaidBills || 0,
  };

  try {
    // Check for contract status change
    const regaStatus = data.contractStatus || null;
    const isExpired = regaStatus &&
      (regaStatus.toLowerCase().includes("expired") ||
       regaStatus.includes("منتهي") ||
       regaStatus.toLowerCase().includes("terminated") ||
       regaStatus.includes("ملغي"));

    if (isExpired && tenant.status === "active") {
      result.statusChanged = true;
      result.newStatus = "expired";
      await supabase.from("tenants").update({
        status: "expired",
        ejar_contract_status: regaStatus,
        ejar_last_sync: new Date().toISOString(),
      }).eq("id", tenant.id);
    } else {
      // Update sync timestamp and status
      await supabase.from("tenants").update({
        ejar_contract_status: regaStatus || tenant.ejar_contract_status,
        ejar_last_sync: new Date().toISOString(),
      }).eq("id", tenant.id);
    }

    // Process payment records
    const { billCount, unpaidBills, totalAmount, paymentType } = data;
    if (billCount > 0 && totalAmount > 0) {
      const paidCount = billCount - (unpaidBills || 0);

      const { count: existingCount } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id);

      const newPaidCount = paidCount - (existingCount || 0);
      if (newPaidCount > 0 && tenant.lease_start) {
        const perBillAmount = totalAmount / billCount;
        const intervalMap: Record<string, number> = {
          "monthly": 1, "quarterly": 3, "semi-annual": 6, "annual": 12,
        };
        const interval = intervalMap[paymentType] || 1;
        const payments = [];
        const start = new Date(tenant.lease_start + "T12:00:00");

        for (let i = existingCount || 0; i < paidCount; i++) {
          const payDate = new Date(start);
          payDate.setMonth(payDate.getMonth() + i * interval);
          const dateStr = payDate.toISOString().split("T")[0];
          const monthYear = getDuePeriodMonth(tenant.lease_start, tenant.payment_frequency, payDate);
          payments.push({
            tenant_id: tenant.id,
            property_id: tenant.property_id,
            amount: Math.round(perBillAmount * 100) / 100,
            payment_date: dateStr,
            month_year: monthYear,
          });
        }

        if (payments.length > 0) {
          await supabase.from("payments").insert(payments);
          result.newPayments = payments.length;
        }
      }
    }
  } catch (e: any) {
    result.error = e.message || "Unknown error";
  }

  return result;
}

/** Check if enough time has passed since the last Ejar sync. */
export async function shouldSyncEjar(uid: string): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(userKey(uid, EJAR_SYNC_COOLDOWN_KEY));
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > SYNC_COOLDOWN_MS;
  } catch {
    return true;
  }
}

/** Record the current time as the last sync time. */
export async function markEjarSynced(uid: string): Promise<void> {
  await AsyncStorage.setItem(userKey(uid, EJAR_SYNC_COOLDOWN_KEY), String(Date.now())).catch(() => {});
}
