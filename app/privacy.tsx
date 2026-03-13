import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, radii } from "../constants/theme";

const SECTIONS = [
  { title: "privacyIntroTitle", body: "privacyIntroBody" },
  { title: "privacyDataCollectedTitle", body: "privacyDataCollectedBody" },
  { title: "privacyHowWeUseTitle", body: "privacyHowWeUseBody" },
  { title: "privacyDataStorageTitle", body: "privacyDataStorageBody" },
  { title: "privacySharingTitle", body: "privacySharingBody" },
  { title: "privacyRightsTitle", body: "privacyRightsBody" },
  { title: "privacyChangesTitle", body: "privacyChangesBody" },
  { title: "privacyContactTitle", body: "privacyContactBody" },
] as const;

export default function PrivacyScreen() {
  const { t, isRTL } = useLanguage();
  const { colors: C, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const S = useMemo(() => styles(C, shadow), [C, shadow]);

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
          <Text style={S.headerTitle}>{t("privacyPolicy")}</Text>
        </View>
        <View style={S.headerSide} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={[S.updated, isRTL && { textAlign: "right" }]}>
          {t("lastUpdated")}: March 2026
        </Text>

        {SECTIONS.map(({ title, body }, idx) => (
          <View key={title} style={idx > 0 ? { marginTop: 20 } : undefined}>
            <Text style={[S.sectionTitle, isRTL && { textAlign: "right" }]}>
              {t(title)}
            </Text>
            <View style={S.card}>
              <Text style={[S.body, isRTL && { textAlign: "right" }]}>
                {t(body)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = (C: any, shadow: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingBottom: 12, paddingHorizontal: spacing.md,
      backgroundColor: C.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    headerSide: { width: 60 },
    headerCenter: { flex: 1, alignItems: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: C.text },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.background, alignItems: "center", justifyContent: "center" },
    backArrow: { fontSize: 22, fontWeight: "700", color: C.text, marginTop: -2 },
    rowRev: { flexDirection: "row-reverse" },
    updated: { fontSize: 12, color: C.textMuted, marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 8, marginHorizontal: 4 },
    card: {
      backgroundColor: C.surface, borderRadius: radii.lg,
      padding: 16, ...shadow,
    },
    body: { fontSize: 14, lineHeight: 22, color: C.text },
  });
