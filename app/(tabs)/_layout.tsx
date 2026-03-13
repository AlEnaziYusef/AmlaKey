import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { t, isRTL } = useLanguage();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("dashboard"),
        tabBarAccessibilityLabel: t("dashboard"),
        tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="properties" options={{ title: t("properties"),
        tabBarAccessibilityLabel: t("properties"),
        tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="expenses" options={{ title: t("expenses"),
        tabBarAccessibilityLabel: t("expenses"),
        tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("profile"),
        tabBarAccessibilityLabel: t("profile"),
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="tenants" options={{ href: null }} />
    </Tabs>
  );
}
