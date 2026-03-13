export type ColorSet = {
  background: string; surface: string; surfaceElevated: string; surfaceAlt: string;
  primary: string; accent: string; accentSoft: string;
  text: string; textMuted: string; border: string; danger: string;
};

export const darkColors: ColorSet = {
  background: "#020617", surface: "#0B1220", surfaceElevated: "#0F172A", surfaceAlt: "#0F172A",
  primary: "#0EA5E9", accent: "#14B8A6", accentSoft: "rgba(20, 184, 166, 0.12)",
  text: "#F9FAFB", textMuted: "#9CA3AF", border: "rgba(148, 163, 184, 0.35)", danger: "#F97373",
};

export const lightColors: ColorSet = {
  background: "#F1F5F9", surface: "#FFFFFF", surfaceElevated: "#E2E8F0", surfaceAlt: "#F8FAFC",
  primary: "#0284C7", accent: "#0D9488", accentSoft: "rgba(13, 148, 136, 0.1)",
  text: "#0F172A", textMuted: "#64748B", border: "rgba(148, 163, 184, 0.3)", danger: "#DC2626",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 };
export const radii = { sm: 8, md: 12, lg: 16, pill: 999 };

export function makeShadow(isDark: boolean) {
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: isDark ? 4 : 2 },
    shadowOpacity: isDark ? 0.15 : 0.07,
    shadowRadius: isDark ? 8 : 4,
    elevation: isDark ? 5 : 3,
  };
}

// Backward compat aliases (dark as default)
export const colors = darkColors;
export const COLORS = darkColors;
export const SPACING = spacing;
export const RADIUS = { ...radii, full: 999 };
export const SHADOWS = {
  card: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },
};
