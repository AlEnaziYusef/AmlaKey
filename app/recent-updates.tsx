import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useLanguage, TKey } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, radii } from "../constants/theme";

interface Update {
  id: string; icon: string; title: string; sub: string;
  amount?: number; time: string; color: string;
  detail?: string; propertyName?: string; unitNumber?: string;
  propertyId?: string; tenantId?: string;
}

function getDateGroup(dateStr: string, t: (k: TKey) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  if (date >= todayStart) return t("today");
  if (date >= yesterdayStart) return t("yesterday");
  if (date >= weekStart) return t("thisWeek");
  return t("earlier");
}

type FilterType = "all" | "overdue" | "tenant" | "payment" | "expense";

function timeAgo(dateStr: string, isRTL: boolean) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (isRTL) {
    if (m < 60) return `قبل ${m} د`;
    if (h < 24) return `قبل ${h} س`;
    return `قبل ${d} ي`;
  }
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function formatFullDate(dateStr: string, language: string) {
  try {
    const locale = language === "ar" ? "ar-SA" : "en-GB";
    return new Date(dateStr).toLocaleDateString(locale, {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return dateStr; }
}

export default function RecentUpdatesScreen() {
  const { t, isRTL, lang } = useLanguage();
  const { colors: C, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const S = useMemo(() => styles(C, shadow), [C, shadow]);

  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchUpdates(); }, []);

  async function fetchUpdates() {
    setLoading(true);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const [
      { data: recentTenants },
      { data: recentPayments },
      { data: recentExpenses },
      { data: activeTenants },
      { data: monthPayments },
    ] = await Promise.all([
      supabase.from("tenants")
        .select("id, name, unit_number, monthly_rent, created_at, properties(id, name)")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("payments")
        .select("id, amount, tenant_id, created_at, tenants(name, unit_number, properties(id, name))")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("expenses")
        .select("id, category, amount, description, created_at, properties(id, name)")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("tenants")
        .select("id, name, unit_number, property_id, monthly_rent, lease_start, properties(name)")
        .eq("status", "active"),
      supabase.from("payments")
        .select("tenant_id").eq("month_year", thisMonth),
    ]);

    // Compute overdue tenants
    const today = new Date();
    const currentDay = today.getDate();
    const paidTenantIds = new Set((monthPayments ?? []).map((p: any) => p.tenant_id));
    const now = new Date().toISOString();

    const overdueUpdates: Update[] = [];
    for (const tn of activeTenants ?? []) {
      if (!tn.lease_start) continue;
      const dueDay = new Date(tn.lease_start + "T12:00:00").getDate();
      if (currentDay >= dueDay && !paidTenantIds.has(tn.id)) {
        const daysOverdue = currentDay - dueDay;
        const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay, 12, 0, 0);
        overdueUpdates.push({
          id: `o-${tn.id}`, icon: "⚠️", title: tn.name,
          sub: `${t("overdue")} - ${t("unit")} ${tn.unit_number}, ${(tn as any).properties?.name ?? ""}`,
          amount: tn.monthly_rent, time: dueDate.toISOString(), color: "#F59E0B",
          detail: `${daysOverdue} ${t("daysOverdue")}`,
          propertyName: (tn as any).properties?.name ?? "",
          unitNumber: String(tn.unit_number),
          propertyId: tn.property_id,
          tenantId: tn.id,
        });
      }
    }

    const recentMerged: Update[] = [
      ...(recentTenants ?? []).map((tn: any) => ({
        id: `t-${tn.id}`, icon: "👤", title: tn.name,
        sub: `${tn.properties?.name ?? ""} · ${t("unit")} ${tn.unit_number}`,
        amount: tn.monthly_rent, time: tn.created_at, color: C.primary,
        detail: t("newTenantAdded"),
        propertyName: tn.properties?.name ?? "",
        unitNumber: String(tn.unit_number),
        propertyId: tn.properties?.id ?? "",
        tenantId: tn.id,
      })),
      ...(recentPayments ?? []).map((p: any) => {
        const tenant = p.tenants as any;
        return {
          id: `p-${p.id}`, icon: "💰",
          title: tenant?.name ?? t("tenant"),
          sub: t("rentCollected"),
          amount: p.amount, time: p.created_at, color: "#22C55E",
          detail: t("paymentReceived"),
          propertyName: tenant?.properties?.name ?? "",
          unitNumber: tenant?.unit_number ? String(tenant.unit_number) : "",
          propertyId: tenant?.properties?.id ?? "",
          tenantId: p.tenant_id ?? "",
        };
      }),
      ...(recentExpenses ?? []).map((e: any) => ({
        id: `e-${e.id}`, icon: "🧾",
        title: e.category,
        sub: e.properties?.name ?? "",
        amount: e.amount, time: e.created_at, color: "#EF4444",
        detail: e.description || e.category,
        propertyName: e.properties?.name ?? "",
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const merged = [...overdueUpdates, ...recentMerged]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 35);
    setUpdates(merged);
    setLoading(false);
  }

  const filtered = filter === "all" ? updates
    : filter === "overdue" ? updates.filter(u => u.id.startsWith("o-"))
    : filter === "tenant" ? updates.filter(u => u.id.startsWith("t-"))
    : filter === "payment" ? updates.filter(u => u.id.startsWith("p-"))
    : updates.filter(u => u.id.startsWith("e-"));

  const filterCounts = useMemo(() => ({
    overdue: updates.filter(u => u.id.startsWith("o-")).length,
    tenant: updates.filter(u => u.id.startsWith("t-")).length,
    payment: updates.filter(u => u.id.startsWith("p-")).length,
    expense: updates.filter(u => u.id.startsWith("e-")).length,
  }), [updates]);

  const FILTERS: { key: FilterType; label: string; icon: string; count: number }[] = [
    { key: "all", label: t("all"), icon: "", count: updates.length },
    { key: "overdue", label: t("overdue"), icon: "⚠️", count: filterCounts.overdue },
    { key: "tenant", label: t("newTenant"), icon: "👤", count: filterCounts.tenant },
    { key: "payment", label: t("collections"), icon: "💰", count: filterCounts.payment },
    { key: "expense", label: t("expenses"), icon: "🧾", count: filterCounts.expense },
  ];

  return (
    <View style={S.container}>
      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 10 }, isRTL && S.rowRev]}>
        <View style={S.headerSide}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Text style={S.backArrow}>{isRTL ? "›" : "‹"}</Text>
          </TouchableOpacity>
        </View>
        <View style={S.headerCenter}>
          <Text style={S.headerTitle}>{t("allUpdates")}</Text>
        </View>
        <View style={S.headerSide} />
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: 8 }}
        style={{ flexGrow: 0, flexShrink: 0, marginBottom: 8, zIndex: 1 }}
      >
        <View style={[S.filterRow, isRTL && S.rowRev]}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[S.filterTab, filter === f.key && S.filterTabActive]}
              onPress={() => setFilter(f.key)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={[S.filterTabText, filter === f.key && S.filterTabTextActive]}>
                  {f.icon ? `${f.icon} ` : ""}{f.label}
                </Text>
                {f.count > 0 && (
                  <View style={[S.badge, filter === f.key && S.badgeActive]}>
                    <Text style={[S.badgeText, filter === f.key && S.badgeTextActive]}>
                      {f.count}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {filtered.length === 0 && (
            <Text style={S.emptyText}>{t("noUpdates")}</Text>
          )}
          {(() => {
            let lastGroup = "";
            return filtered.map((u) => {
              const isExpanded = expandedId === u.id;
              const isNavigable = !u.id.startsWith("e-");
              const group = getDateGroup(u.time, t);
              const showHeader = group !== lastGroup;
              if (showHeader) lastGroup = group;

              function handlePress() {
                if (isNavigable && u.propertyId && u.tenantId) {
                  router.push({
                    pathname: "/unit-detail",
                    params: {
                      propertyId: u.propertyId,
                      propertyName: u.propertyName ?? "",
                      unitNumber: u.unitNumber ?? "",
                      tenantId: u.tenantId,
                      unitLabel: `${t("unit")} ${u.unitNumber ?? ""}`,
                    },
                  });
                } else {
                  setExpandedId(isExpanded ? null : u.id);
                }
              }

              return (
                <React.Fragment key={u.id}>
                  {showHeader && (
                    <Text style={S.sectionHeader}>{group}</Text>
                  )}
                  <TouchableOpacity
                    style={[S.updateRow, isExpanded && S.updateRowExpanded]}
                    onPress={handlePress}
                    activeOpacity={0.75}
                  >
                    <View style={[S.updateIconWrap, { backgroundColor: u.color + "20" }]}>
                      <Text style={{ fontSize: 18 }}>{u.icon}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[S.updateTitle, isRTL && { textAlign: "right" }]}>{u.title}</Text>
                      <Text style={[S.updateSub, isRTL && { textAlign: "right" }]}>{u.sub}</Text>
                      {isExpanded && (
                        <View style={S.expandedContent}>
                          {u.detail ? (
                            <Text style={S.expandedDetail}>📝 {u.detail}</Text>
                          ) : null}
                          {u.propertyName ? (
                            <Text style={S.expandedDetail}>🏠 {u.propertyName}{u.unitNumber ? ` · ${t("unit")} ${u.unitNumber}` : ""}</Text>
                          ) : null}
                          <Text style={S.expandedDate}>🕐 {formatFullDate(u.time, lang)}</Text>
                        </View>
                      )}
                      {isNavigable && (
                        <Text style={S.tapHint}>{isRTL ? `← ${t("tapToView")}` : `${t("tapToView")} →`}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {u.amount !== undefined && (
                        <Text style={[S.updateAmount, { color: u.color }]}>{u.amount.toLocaleString()} {t("sar")}</Text>
                      )}
                      <Text style={S.updateTime}>{timeAgo(u.time, isRTL)}</Text>
                      {!isNavigable && (
                        <Text style={[S.expandChevron, { color: u.color }]}>{isExpanded ? "▲" : "▼"}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            });
          })()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = (C: any, shadow: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  rowRev: { flexDirection: "row-reverse" },
  headerSide: { width: 44 },
  headerCenter: { flex: 1, alignItems: "center" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  backArrow: { fontSize: 22, color: C.text, fontWeight: "700", marginTop: -2 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: C.text },
  filterRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterTabActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterTabText: { color: C.textMuted, fontSize: 13 },
  filterTabTextActive: { color: "#fff", fontWeight: "700" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.border, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 5 },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  badgeText: { fontSize: 11, fontWeight: "700" as const, color: C.textMuted },
  badgeTextActive: { color: "#fff" },
  updateRow: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.surface, borderRadius: radii.lg, marginHorizontal: spacing.md, marginBottom: 8, padding: spacing.md, ...shadow },
  updateRowExpanded: { borderWidth: 1, borderColor: C.border },
  updateIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 2 },
  updateTitle: { fontSize: 14, fontWeight: "600", color: C.text },
  updateSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  updateAmount: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  updateTime: { fontSize: 11, color: C.textMuted },
  expandChevron: { fontSize: 16, marginTop: 2, opacity: 0.7 },
  expandedContent: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 5 },
  expandedDetail: { fontSize: 12, color: C.text },
  expandedDate: { fontSize: 11, color: C.textMuted },
  sectionHeader: { fontSize: 13, color: C.textMuted, fontWeight: "600", paddingVertical: 8, paddingHorizontal: spacing.md },
  tapHint: { fontSize: 11, color: C.textMuted, marginTop: 4, opacity: 0.7 },
  emptyText: { textAlign: "center", color: C.textMuted, marginTop: 60, fontSize: 15 },
});
