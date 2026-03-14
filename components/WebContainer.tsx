import React from "react";
import { Platform, View, ViewStyle, useWindowDimensions } from "react-native";

/* ── Responsive hook ─────────────────────────────────── */

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  return {
    isDesktop: isWeb && width >= 768,
    isWide: isWeb && width >= 1024,
    isMobile: !isWeb || width < 768,
    width,
  };
}

/* ── useHover hook (web-only mouse events) ───────────── */

export function useHover() {
  const [hovered, setHovered] = React.useState(false);
  const bind =
    Platform.OS === "web"
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};
  return { hovered, bind };
}

/* ── WebContainer ────────────────────────────────────── */

type Props = {
  maxWidth?: number;
  style?: ViewStyle;
  children: React.ReactNode;
};

/**
 * Responsive wrapper — on web, constrains content to maxWidth and centers it.
 * On native, renders children with zero overhead.
 */
export default function WebContainer({
  maxWidth = 1200,
  style,
  children,
}: Props) {
  if (Platform.OS !== "web") return <>{children}</>;

  return (
    <View
      style={[
        {
          maxWidth,
          width: "100%",
          marginLeft: "auto",
          marginRight: "auto",
          paddingHorizontal: 24,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
