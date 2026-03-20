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

/** Send push notifications via Expo Push API */
async function sendExpoPush(
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    sound?: string;
  }>
) {
  if (messages.length === 0) return [];

  // Expo Push API supports batches of 100
  const results: any[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    const json = await res.json();
    results.push(...(json.data ?? []));
  }
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify cron secret to prevent unauthorized triggers
    const authHeader = req.headers.get("authorization") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Allow either cron secret or valid supabase anon key
    if (
      cronSecret &&
      !authHeader.includes(cronSecret) &&
      !authHeader.includes(supabaseAnonKey)
    ) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SB_SERVICE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Server config missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const currentMonth = todayStr.slice(0, 7); // YYYY-MM

    // Get all users with push tokens
    const { data: tokens, error: tokErr } = await supabase
      .from("push_tokens")
      .select("user_id, token");

    if (tokErr || !tokens?.length) {
      return respond({
        message: "No push tokens found",
        error: tokErr?.message,
      });
    }

    // Group tokens by user
    const userTokens = new Map<string, string[]>();
    for (const t of tokens) {
      const arr = userTokens.get(t.user_id) ?? [];
      arr.push(t.token);
      userTokens.set(t.user_id, arr);
    }

    const userIds = [...userTokens.keys()];

    // Fetch notification settings for all users
    const { data: allSettings } = await supabase
      .from("notification_settings")
      .select("*")
      .in("user_id", userIds);

    const settingsMap = new Map<string, any>();
    for (const s of allSettings ?? []) {
      settingsMap.set(s.user_id, s);
    }

    // Fetch tenants for all users with push tokens
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name, monthly_rent, lease_start, lease_end, status, property_id, user_id")
      .in("user_id", userIds)
      .eq("status", "active");

    if (!tenants?.length) {
      return respond({ message: "No active tenants found" });
    }

    // Fetch payments for current month
    const { data: payments } = await supabase
      .from("payments")
      .select("tenant_id, amount")
      .eq("month_year", currentMonth);

    const paidMap = new Map<string, number>();
    for (const p of payments ?? []) {
      paidMap.set(p.tenant_id, (paidMap.get(p.tenant_id) ?? 0) + (p.amount ?? 0));
    }

    // Build push messages
    const messages: Array<{
      to: string;
      title: string;
      body: string;
      data?: Record<string, string>;
      sound?: string;
    }> = [];

    for (const tenant of tenants) {
      const uTokens = userTokens.get(tenant.user_id);
      if (!uTokens?.length) continue;

      const settings = settingsMap.get(tenant.user_id) ?? {
        rent_reminders: true,
        rent_reminder_days: 3,
        overdue_alerts: true,
        lease_expiry: true,
        lease_expiry_days: 14,
        sound: true,
        lang: "ar",
      };

      const isAr = settings.lang === "ar";
      const totalPaid = paidMap.get(tenant.id) ?? 0;
      const hasPaid = totalPaid >= tenant.monthly_rent;
      const dueDay = new Date(tenant.lease_start + "T12:00:00").getDate();

      // ── Rent due reminder ──
      if (settings.rent_reminders && !hasPaid) {
        const dueDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          dueDay
        );
        const diffDays = Math.round(
          (dueDate.getTime() - today.getTime()) / 86400000
        );

        if (diffDays > 0 && diffDays <= settings.rent_reminder_days) {
          for (const token of uTokens) {
            messages.push({
              to: token,
              title: isAr ? "تذكير بالإيجار" : "Rent Reminder",
              body: isAr
                ? `إيجار ${tenant.name} مستحق خلال ${diffDays} ${diffDays === 1 ? "يوم" : "أيام"}`
                : `${tenant.name}'s rent is due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
              data: {
                type: "rent_due_reminder",
                tenantId: tenant.id,
                propertyId: tenant.property_id ?? "",
              },
              sound: settings.sound ? "default" : undefined,
            });
          }
        }
      }

      // ── Overdue rent alert ──
      if (settings.overdue_alerts && !hasPaid) {
        const dueDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          dueDay
        );
        const diffDays = Math.round(
          (today.getTime() - dueDate.getTime()) / 86400000
        );

        // Send on escalating intervals: 0, 1, 3, 7, 14, 30 days overdue
        if ([0, 1, 3, 7, 14, 30].includes(diffDays)) {
          let title: string;
          let body: string;

          if (diffDays === 0) {
            title = isAr ? "الإيجار مستحق اليوم" : "Rent Due Today";
            body = isAr
              ? `إيجار ${tenant.name} بقيمة ${tenant.monthly_rent} ريال مستحق اليوم`
              : `${tenant.name}'s rent of ${tenant.monthly_rent} SAR is due today`;
          } else if (diffDays <= 3) {
            title = isAr ? "إيجار متأخر" : "Overdue Rent";
            body = isAr
              ? `الإيجار متأخر بـ ${diffDays} أيام`
              : `Rent is ${diffDays} days overdue`;
          } else if (diffDays === 7) {
            title = isAr ? "عاجل: إيجار متأخر" : "Urgent: Overdue Rent";
            body = isAr
              ? `الإيجار متأخر بـ 7 أيام - عاجل`
              : `Rent is 7 days overdue - urgent`;
          } else if (diffDays === 14) {
            title = isAr ? "عاجل: إيجار متأخر" : "Urgent: Overdue Rent";
            body = isAr
              ? `الإيجار متأخر بـ 14 يوم - يتطلب إجراء`
              : `Rent is 14 days overdue - action required`;
          } else {
            title = isAr ? "حرج: إيجار متأخر" : "Critical: Overdue Rent";
            body = isAr
              ? `الإيجار متأخر بـ 30 يوم - حرج`
              : `Rent is 30 days overdue - critical`;
          }

          for (const token of uTokens) {
            messages.push({
              to: token,
              title,
              body,
              data: {
                type: "overdue_rent",
                tenantId: tenant.id,
                propertyId: tenant.property_id ?? "",
              },
              sound: settings.sound ? "default" : undefined,
            });
          }
        }
      }

      // ── Lease expiry warning ──
      if (settings.lease_expiry && tenant.lease_end) {
        const leaseEnd = new Date(tenant.lease_end + "T12:00:00");
        const daysToExpiry = Math.round(
          (leaseEnd.getTime() - today.getTime()) / 86400000
        );

        if (daysToExpiry === settings.lease_expiry_days || daysToExpiry === 7 || daysToExpiry === 1) {
          for (const token of uTokens) {
            messages.push({
              to: token,
              title: isAr ? "انتهاء عقد إيجار" : "Lease Expiring",
              body: isAr
                ? `عقد ${tenant.name} ينتهي خلال ${daysToExpiry} ${daysToExpiry === 1 ? "يوم" : "يوم"}`
                : `${tenant.name}'s lease expires in ${daysToExpiry} day${daysToExpiry === 1 ? "" : "s"}`,
              data: {
                type: "lease_expiry_warning",
                tenantId: tenant.id,
                propertyId: tenant.property_id ?? "",
              },
              sound: settings.sound ? "default" : undefined,
            });
          }
        }
      }
    }

    // Send all push notifications
    const results = await sendExpoPush(messages);

    return respond({
      sent: messages.length,
      results: results.length,
      users: userIds.length,
      tenants: tenants.length,
    });
  } catch (err) {
    return respond(
      { error: (err as Error).message || "Internal server error" },
      500
    );
  }
});
