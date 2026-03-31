import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, radii } from "../constants/theme";
import { supabase } from "../lib/supabase";

const isWeb = Platform.OS === "web";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RequestStatus = "open" | "in_progress" | "resolved" | "closed";
type RequestCategory = "paint" | "electricity" | "plumbing" | "floor" | "other";

interface MaintenanceRequest {
  id: string;
  user_id: string;
  tenant_id: string;
  property_id: string;
  unit_number: string;
  category: RequestCategory;
  description: string;
  image_path: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  tenants: { name: string; phone: string } | null;
  properties: { name: string } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<RequestCategory, { icon: string; labelKey: string }> = {
  paint: { icon: "\uD83C\uDFA8", labelKey: "maintenancePaint" },
  electricity: { icon: "\u26A1", labelKey: "maintenanceElectricity" },
  plumbing: { icon: "\uD83D\uDD27", labelKey: "maintenancePlumbing" },
  floor: { icon: "\uD83C\uDFD7\uFE0F", labelKey: "maintenanceFloor" },
  other: { icon: "\uD83D\uDCCB", labelKey: "maintenanceOther" },
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  open: "#EF4444",
  in_progress: "#F59E0B",
  resolved: "#22C55E",
  closed: "#9CA3AF",
};

const STATUS_KEYS: RequestStatus[] = ["open", "in_progress", "resolved", "closed"];

const STATUS_LABEL_KEYS: Record<RequestStatus, string> = {
  open: "maintenanceOpen",
  in_progress: "maintenanceInProgress",
  resolved: "maintenanceResolved",
  closed: "maintenanceClosed",
};

const CATEGORY_KEYS: RequestCategory[] = ["paint", "electricity", "plumbing", "floor", "other"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string, isRTL: boolean): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return isRTL ? "الآن" : "Just now";
  if (diffMin < 60) return isRTL ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  if (diffHr < 24) return isRTL ? `منذ ${diffHr} ساعة` : `${diffHr}h ago`;
  if (diffDay === 1) return isRTL ? "أمس" : "Yesterday";
  if (diffDay < 30) return isRTL ? `منذ ${diffDay} يوم` : `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MaintenanceScreen() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { colors: C, shadow, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const S = useMemo(() => styles(C, shadow, isRTL), [C, shadow, isRTL]);

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | "all">("all");

  // Expanded description
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Image viewer
  const [imageModal, setImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Status picker
  const [statusPickerId, setStatusPickerId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*, tenants(name, phone), properties(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        if (__DEV__) console.error("maintenance fetch error:", error);
      }
      setRequests((data as MaintenanceRequest[]) || []);
    } catch (e) {
      if (__DEV__) console.error(e);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRequests().finally(() => setLoading(false));
  }, [fetchRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [fetchRequests]);

  // ---------------------------------------------------------------------------
  // Filtered data
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    let list = requests;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (categoryFilter !== "all") {
      list = list.filter((r) => r.category === categoryFilter);
    }
    return list;
  }, [requests, statusFilter, categoryFilter]);

  // Summary counts (always from full list, not filtered)
  const openCount = useMemo(() => requests.filter((r) => r.status === "open").length, [requests]);
  const inProgressCount = useMemo(() => requests.filter((r) => r.status === "in_progress").length, [requests]);
  const resolvedCount = useMemo(() => requests.filter((r) => r.status === "resolved").length, [requests]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function changeStatus(requestId: string, newStatus: RequestStatus) {
    // Optimistic update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r
      )
    );
    setStatusPickerId(null);

    const { error } = await supabase
      .from("maintenance_requests")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (error) {
      if (__DEV__) console.error("status update error:", error);
      // Revert on failure
      await fetchRequests();
    }
  }

  async function openImage(imagePath: string) {
    setImageLoading(true);
    setImageModal(true);
    try {
      const { data, error } = await supabase.storage
        .from("maintenance-images")
        .createSignedUrl(imagePath, 3600);
      if (error) throw error;
      setImageUrl(data.signedUrl);
    } catch (e) {
      if (__DEV__) console.error("image url error:", e);
      setImageUrl(null);
    }
    setImageLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderStatusBadge(status: RequestStatus, requestId: string) {
    const color = STATUS_COLORS[status];
    return (
      <TouchableOpacity
        style={[S.statusBadge, { backgroundColor: color + "20", borderColor: color }]}
        onPress={() => setStatusPickerId(statusPickerId === requestId ? null : requestId)}
        activeOpacity={0.7}
      >
        <View style={[S.statusDot, { backgroundColor: color }]} />
        <Text style={[S.statusText, { color }]}>{t(STATUS_LABEL_KEYS[status] as any)}</Text>
      </TouchableOpacity>
    );
  }

  function renderStatusPicker(request: MaintenanceRequest) {
    if (statusPickerId !== request.id) return null;
    const currentIdx = STATUS_KEYS.indexOf(request.status);
    // Allow moving forward or to any status
    return (
      <View style={S.statusPicker}>
        {STATUS_KEYS.filter((s) => s !== request.status).map((s) => {
          const color = STATUS_COLORS[s];
          return (
            <TouchableOpacity
              key={s}
              style={[S.statusOption, { borderColor: color }]}
              onPress={() => changeStatus(request.id, s)}
              activeOpacity={0.7}
            >
              <View style={[S.statusDot, { backgroundColor: color }]} />
              <Text style={[S.statusOptionText, { color }]}>{t(STATUS_LABEL_KEYS[s] as any)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderCard({ item }: { item: MaintenanceRequest }) {
    const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
    const isExpanded = expandedId === item.id;

    return (
      <View style={S.card}>
        {/* Top row: category + status */}
        <View style={[S.cardTopRow, isRTL && S.rowRev]}>
          <View style={[S.categoryRow, isRTL && S.rowRev]}>
            <Text style={S.categoryIcon}>{cat.icon}</Text>
            <Text style={S.categoryLabel}>{t(cat.labelKey as any)}</Text>
          </View>
          {renderStatusBadge(item.status, item.id)}
        </View>

        {/* Status picker (inline, below badge) */}
        {renderStatusPicker(item)}

        {/* Tenant + property info */}
        <View style={[S.infoRow, isRTL && S.rowRev]}>
          <Text style={S.tenantName}>{item.tenants?.name || t("unknown" as any)}</Text>
          <Text style={S.separator}>|</Text>
          <Text style={S.unitText}>{t("unit" as any)} {item.unit_number}</Text>
        </View>
        <Text style={[S.propertyName, isRTL && { textAlign: "right" }]}>
          {item.properties?.name || ""}
        </Text>

        {/* Description */}
        <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : item.id)} activeOpacity={0.7}>
          <Text
            style={[S.description, isRTL && { textAlign: "right" }]}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {item.description}
          </Text>
        </TouchableOpacity>

        {/* Image thumbnail */}
        {item.image_path ? (
          <TouchableOpacity onPress={() => openImage(item.image_path!)} activeOpacity={0.8} style={S.thumbWrap}>
            <View style={S.thumbPlaceholder}>
              <Text style={S.thumbIcon}>{"\uD83D\uDDBC\uFE0F"}</Text>
              <Text style={S.thumbLabel}>{t("viewImage" as any)}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Footer: date */}
        <Text style={[S.dateText, isRTL && { textAlign: "right" }]}>
          {relativeTime(item.created_at, isRTL)}
        </Text>
      </View>
    );
  }

  function renderEmpty() {
    return (
      <View style={S.emptyContainer}>
        <Text style={S.emptyIcon}>{"\uD83D\uDD27"}</Text>
        <Text style={S.emptyText}>{t("noMaintenanceRequests" as any)}</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={S.container}>
      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 10 }, isRTL && S.rowRev]}>
        <View style={S.headerSide}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Text style={S.backArrow}>{isRTL ? "\u203A" : "\u2039"}</Text>
          </TouchableOpacity>
        </View>
        <View style={S.headerCenter}>
          <Text style={S.headerTitle}>{t("maintenanceRequests" as any)}</Text>
        </View>
        <View style={S.headerSide} />
      </View>

      {/* Summary cards */}
      <View style={[S.summaryRow, isRTL && S.rowRev]}>
        <View style={[S.summaryCard, { borderTopColor: STATUS_COLORS.open }]}>
          <Text style={[S.summaryCount, { color: STATUS_COLORS.open }]}>{openCount}</Text>
          <Text style={S.summaryLabel}>{t("maintenanceOpen" as any)}</Text>
        </View>
        <View style={[S.summaryCard, { borderTopColor: STATUS_COLORS.in_progress }]}>
          <Text style={[S.summaryCount, { color: STATUS_COLORS.in_progress }]}>{inProgressCount}</Text>
          <Text style={S.summaryLabel}>{t("maintenanceInProgress" as any)}</Text>
        </View>
        <View style={[S.summaryCard, { borderTopColor: STATUS_COLORS.resolved }]}>
          <Text style={[S.summaryCount, { color: STATUS_COLORS.resolved }]}>{resolvedCount}</Text>
          <Text style={S.summaryLabel}>{t("maintenanceResolved" as any)}</Text>
        </View>
      </View>

      {/* Status filter chips */}
      <View style={S.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: "all" as const, label: t("all" as any) },
            ...STATUS_KEYS.map((s) => ({ key: s, label: t(STATUS_LABEL_KEYS[s] as any) })),
          ]}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[S.chipRow, isRTL && { flexDirection: "row-reverse" }]}
          renderItem={({ item }) => {
            const active = statusFilter === item.key;
            const color = item.key === "all" ? C.accent : STATUS_COLORS[item.key as RequestStatus];
            return (
              <TouchableOpacity
                style={[S.chip, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => setStatusFilter(item.key as any)}
                activeOpacity={0.7}
              >
                <Text style={[S.chipText, active && S.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Category filter chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: "all" as const, label: t("all" as any), icon: "" },
            ...CATEGORY_KEYS.map((c) => ({
              key: c,
              label: t(CATEGORY_META[c].labelKey as any),
              icon: CATEGORY_META[c].icon,
            })),
          ]}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[S.chipRow, { marginTop: spacing.xs }, isRTL && { flexDirection: "row-reverse" }]}
          renderItem={({ item }) => {
            const active = categoryFilter === item.key;
            return (
              <TouchableOpacity
                style={[S.chip, active && { backgroundColor: C.accent, borderColor: C.accent }]}
                onPress={() => setCategoryFilter(item.key as any)}
                activeOpacity={0.7}
              >
                <Text style={[S.chipText, active && S.chipTextActive]}>
                  {item.icon ? `${item.icon} ` : ""}{item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Request list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      />

      {/* Full-screen image modal */}
      <Modal visible={imageModal} transparent animationType="fade" onRequestClose={() => setImageModal(false)}>
        <View style={S.imageModalBackdrop}>
          <TouchableOpacity style={S.imageModalClose} onPress={() => { setImageModal(false); setImageUrl(null); }}>
            <Text style={S.imageModalCloseText}>{"\u2715"}</Text>
          </TouchableOpacity>
          {imageLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : imageUrl ? (
            <Image source={{ uri: imageUrl }} style={S.imageModalImage} resizeMode="contain" />
          ) : (
            <Text style={S.imageModalError}>{t("failedToLoadImage" as any)}</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = (C: any, shadow: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 12,
      paddingHorizontal: spacing.md,
      backgroundColor: C.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    headerSide: { width: 60 },
    headerCenter: { flex: 1, alignItems: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: C.text },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.background,
      alignItems: "center",
      justifyContent: "center",
    },
    backArrow: { fontSize: 22, fontWeight: "700", color: C.text, marginTop: -2 },
    rowRev: { flexDirection: "row-reverse" as const },

    // Summary cards
    summaryRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      alignItems: "center",
      borderTopWidth: 3,
      ...shadow,
    },
    summaryCount: { fontSize: 24, fontWeight: "800" },
    summaryLabel: { fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: "center" },

    // Filter chips
    filterSection: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: spacing.lg,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    chipText: { fontSize: 13, color: C.text, fontWeight: "500" },
    chipTextActive: { color: "#fff", fontWeight: "700" },

    // Request card
    card: {
      backgroundColor: C.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow,
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    categoryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    categoryIcon: { fontSize: 20 },
    categoryLabel: { fontSize: 14, fontWeight: "600", color: C.text },

    // Status badge
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: "600" },

    // Status picker (inline)
    statusPicker: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: spacing.sm,
      paddingTop: spacing.xs,
    },
    statusOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      borderWidth: 1,
      backgroundColor: C.background,
    },
    statusOptionText: { fontSize: 12, fontWeight: "600" },

    // Info rows
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    tenantName: { fontSize: 14, fontWeight: "600", color: C.text },
    separator: { fontSize: 12, color: C.textMuted },
    unitText: { fontSize: 13, color: C.textMuted },
    propertyName: { fontSize: 12, color: C.textMuted, marginBottom: spacing.sm },

    // Description
    description: { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: spacing.sm },

    // Image thumbnail
    thumbWrap: { marginBottom: spacing.sm },
    thumbPlaceholder: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: C.background,
      borderRadius: radii.sm,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: C.border,
    },
    thumbIcon: { fontSize: 18 },
    thumbLabel: { fontSize: 13, color: C.primary, fontWeight: "500" },

    // Date
    dateText: { fontSize: 12, color: C.textMuted },

    // Empty state
    emptyContainer: { alignItems: "center", paddingTop: 60 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15, color: C.textMuted, textAlign: "center" },

    // Image modal
    imageModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      justifyContent: "center",
      alignItems: "center",
    },
    imageModalClose: {
      position: "absolute",
      top: 60,
      right: 20,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    imageModalCloseText: { fontSize: 20, color: "#fff", fontWeight: "700" },
    imageModalImage: { width: "90%", height: "70%" },
    imageModalError: { fontSize: 15, color: "#fff" },
  });
