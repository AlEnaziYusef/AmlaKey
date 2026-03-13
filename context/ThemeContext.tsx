import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ColorSet, darkColors, lightColors, makeShadow } from "../constants/theme";

export type ThemeMode = "dark" | "light";

interface ThemeCtx {
  mode: ThemeMode;
  toggleTheme: () => void;
  colors: ColorSet;
  isDark: boolean;
  shadow: ReturnType<typeof makeShadow>;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: "dark", toggleTheme: () => {}, colors: darkColors, isDark: true, shadow: makeShadow(true),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem("@theme").then((v) => {
      if (v === "light" || v === "dark") {
        setMode(v);
      } else if (systemScheme) {
        setMode(systemScheme as ThemeMode);
      }
    }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    await AsyncStorage.setItem("@theme", next);
  }, [mode]);

  const value = useMemo(() => ({
    mode, toggleTheme,
    colors: mode === "dark" ? darkColors : lightColors,
    isDark: mode === "dark",
    shadow: makeShadow(mode === "dark"),
  }), [mode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
