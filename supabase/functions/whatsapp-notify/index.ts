import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Set to true once Meta approves your WhatsApp message templates
const USE_TEMPLATES = false;

/**
 * Convert Saudi local phone format to international E.164.
 * 05XXXXXXXX -> +9665XXXXXXXX
 */
function toE164(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    return "+966" + cleaned.slice(1);
  }
  if (cleaned.startsWith("+966") && cleaned.length === 13) {
    return cleaned;
  }
  if (cleaned.startsWith("966") && cleaned.length === 12) {
    return "+" + cleaned;
  }
  return null;
}

/** Format date as YYYY-MM-DD */
function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ── Direct text messages (fallback when templates are not approved) ──

function rentReminderText(
  lang: string,
  name: string,
  amount: number,
  unit: string,
  date: string
): string {
  if (lang === "ar") {
    return `\u0645\u0631\u062d\u0628\u0627\u064b ${name}\u060c \u0647\u0630\u0627 \u062a\u0630\u0643\u064a\u0631 \u0628\u0623\u0646 \u0625\u064a\u062c\u0627\u0631\u0643 \u0627\u0644\u0628\u0627\u0644\u063a ${amount} \u0631\u064a\u0627\u0644 \u0644\u0644\u0648\u062d\u062f\u0629 ${unit} \u0645\u0633\u062a\u062d\u0642 \u0628\u062a\u0627\u0631\u064a\u062e ${date}. \u064a\u0631\u062c\u0649 \u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u062f\u0641\u0639. - \u0623\u0645\u0644\u0627\u0643\u064a`;
  }
  return `Hello ${name}, this is a reminder that your rent of ${amount} SAR for unit ${unit} is due on ${date}. Please arrange payment. - Amlakey`;
}

function leaseExpiryText(
  lang: string,
  name: string,
  unit: string,
  date: string
): string {
  if (lang === "ar") {
    return `\u0645\u0631\u062d\u0628\u0627\u064b ${name}\u060c \u0639\u0642\u062f \u0625\u064a\u062c\u0627\u0631\u0643 \u0644\u0644\u0648\u062d\u062f\u0629 ${unit} \u0633\u064a\u0646\u062a\u0647\u064a \u0628\u062a\u0627\u0631\u064a\u062e ${date}. \u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0624\u062c\u0631 \u0644\u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u062a\u062c\u062f\u064a\u062f. - \u0623\u0645\u0644\u0627\u0643\u064a`;
  }
  return `Hello ${name}, your lease for unit ${unit} will expire on ${date}. Please contact your landlord to discuss renewal. - Amlakey`;
}

// ── WhatsApp send helpers ──

interface WhatsAppResult {
  success: boolean;
  phone: string;
  error?: string;
}

async function sendWhatsAppTemplate(
  phoneId: string,
  token: string,
  phone: string,
  templateName: string,
  lang: string,
  params: string[]
): Promise<WhatsAppResult> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: lang === "ar" ? "ar" : "en" },
            components: [
              {
                type: "body",
                parameters: params.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return { success: false, phone, error: `HTTP ${res.status}: ${err}` };
    }
    return { success: true, phone };
  } catch (e) {
    return { success: false, phone, error: (e as Error).message };
  }
}

async function sendWhatsAppText(
  phoneId: string,
  token: string,
  phone: string,
  message: string
): Promise<WhatsAppResult> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return { success: false, phone, error: `HTTP ${res.status}: ${err}` };
    }
    return { success: true, phone };
  } catch (e) {
    return { success: false, phone, error: (e as Error).message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: verify cron secret (same as push-notify) ──
    const authHeader = req.headers.get("authorization") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (
      cronSecret &&
      !authHeader.includes(cronSecret) &&
      !authHeader.includes(supabaseAnonKey)
    ) {
      return respond({ error: "Unauthorized" }, 401);
    }

    // ── Supabase service-role client ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SB_SERVICE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Server config missing" }, 500);
    }

    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
    const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
      return respond({ error: "WhatsApp config missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const currentMonth = todayStr.slice(0, 7); // YYYY-MM

    // ── Fetch tenants with WhatsApp enabled and a phone number ──
    const { data: tenants, error: tenantErr } = await supabase
      .from("tenants")
      .select(
        "id, name, phone, monthly_rent, lease_start, lease_end, status, property_id, user_id, unit_number"
      )
      .eq("status", "active")
      .eq("whatsapp_enabled", true)
      .not("phone", "is", null);

    if (tenantErr) {
      return respond({ error: tenantErr.message }, 500);
    }

    if (!tenants?.length) {
      return respond({ message: "No WhatsApp-enabled tenants found", sent: 0, errors: 0 });
    }

    // ── Fetch notification settings for each tenant's owner ──
    const userIds = [...new Set(tenants.map((t) => t.user_id))];

    const { data: allSettings } = await supabase
      .from("notification_settings")
      .select("*")
      .in("user_id", userIds);

    const settingsMap = new Map<string, any>();
    for (const s of allSettings ?? []) {
      settingsMap.set(s.user_id, s);
    }

    // ── Fetch payments for current month ──
    const tenantIds = tenants.map((t) => t.id);
    const { data: payments } = await supabase
      .from("payments")
      .select("tenant_id, amount")
      .eq("month_year", currentMonth)
      .in("tenant_id", tenantIds);

    const paidMap = new Map<string, number>();
    for (const p of payments ?? []) {
      paidMap.set(p.tenant_id, (paidMap.get(p.tenant_id) ?? 0) + (p.amount ?? 0));
    }

    // ── Build and send WhatsApp messages ──
    let sent = 0;
    let errors = 0;
    const details: string[] = [];

    for (const tenant of tenants) {
      const phone = toE164(tenant.phone);
      if (!phone) {
        errors++;
        details.push(`Invalid phone for tenant ${tenant.name}: ${tenant.phone}`);
        continue;
      }

      const settings = settingsMap.get(tenant.user_id) ?? {
        rent_reminders: true,
        lease_expiry: true,
        whatsapp_enabled: true,
        lang: "ar",
      };

      // Skip if owner has WhatsApp notifications disabled
      if (settings.whatsapp_enabled === false) continue;

      const lang: string = settings.lang ?? "ar";
      const unitLabel = tenant.unit_number ?? tenant.id.slice(0, 6);
      const totalPaid = paidMap.get(tenant.id) ?? 0;
      const hasPaid = totalPaid >= tenant.monthly_rent;

      // ── Rent due reminder (7 days before) ──
      if (settings.rent_reminders !== false && !hasPaid) {
        const dueDay = new Date(tenant.lease_start + "T12:00:00").getDate();
        const dueDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          dueDay
        );
        const diffDays = Math.round(
          (dueDate.getTime() - today.getTime()) / 86400000
        );

        if (diffDays === 7) {
          const dueDateStr = fmtDate(dueDate);
          let result: WhatsAppResult;

          if (USE_TEMPLATES) {
            result = await sendWhatsAppTemplate(
              WHATSAPP_PHONE_ID,
              WHATSAPP_TOKEN,
              phone,
              "rent_reminder",
              lang,
              [tenant.name, String(tenant.monthly_rent), dueDateStr]
            );
          } else {
            const msg = rentReminderText(
              lang,
              tenant.name,
              tenant.monthly_rent,
              unitLabel,
              dueDateStr
            );
            result = await sendWhatsAppText(
              WHATSAPP_PHONE_ID,
              WHATSAPP_TOKEN,
              phone,
              msg
            );
          }

          if (result.success) {
            sent++;
            details.push(`Rent reminder sent to ${tenant.name} (${phone})`);
          } else {
            errors++;
            details.push(
              `Rent reminder failed for ${tenant.name}: ${result.error}`
            );
          }
        }
      }

      // ── Lease expiry warning (60 days before) ──
      if (settings.lease_expiry !== false && tenant.lease_end) {
        const leaseEnd = new Date(tenant.lease_end + "T12:00:00");
        const daysToExpiry = Math.round(
          (leaseEnd.getTime() - today.getTime()) / 86400000
        );

        if (daysToExpiry === 60) {
          const expiryDateStr = fmtDate(leaseEnd);
          let result: WhatsAppResult;

          if (USE_TEMPLATES) {
            result = await sendWhatsAppTemplate(
              WHATSAPP_PHONE_ID,
              WHATSAPP_TOKEN,
              phone,
              "lease_expiry",
              lang,
              [tenant.name, unitLabel, expiryDateStr]
            );
          } else {
            const msg = leaseExpiryText(lang, tenant.name, unitLabel, expiryDateStr);
            result = await sendWhatsAppText(
              WHATSAPP_PHONE_ID,
              WHATSAPP_TOKEN,
              phone,
              msg
            );
          }

          if (result.success) {
            sent++;
            details.push(`Lease expiry warning sent to ${tenant.name} (${phone})`);
          } else {
            errors++;
            details.push(
              `Lease expiry warning failed for ${tenant.name}: ${result.error}`
            );
          }
        }
      }
    }

    return respond({ sent, errors, details });
  } catch (err) {
    return respond(
      { error: (err as Error).message || "Internal server error" },
      500
    );
  }
});
