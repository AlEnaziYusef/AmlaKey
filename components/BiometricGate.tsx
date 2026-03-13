import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

interface Props {
  onAuthenticated: () => void;
  onFallbackPassword: () => void;
}

export default function BiometricGate({ onAuthenticated, onFallbackPassword }: Props) {
  const { colors: C } = useTheme();
  const { t, isRTL } = useLanguage();
  const [authenticating, setAuthenticating] = useState(true);
  const [failed, setFailed] = useState(false);

  const authenticate = async () => {
    setAuthenticating(true);
    setFailed(false);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        onAuthenticated();
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t("biometricPrompt"),
        fallbackLabel: t("biometricFallback"),
        cancelLabel: t("cancel"),
      });
      if (result.success) {
        onAuthenticated();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setAuthenticating(false);
    }
  };

  useEffect(() => {
    authenticate();
  }, []);

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
      <Text style={[s.title, { color: C.text, textAlign: isRTL ? "right" : "center" }]}>
        {t("biometricPrompt")}
      </Text>

      {authenticating && <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 32 }} />}

      {failed && (
        <View style={{ marginTop: 32, gap: 12, width: "100%", paddingHorizontal: 40 }}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: C.accent }]}
            onPress={authenticate}
          >
            <Text style={s.btnText}>{t("biometricRetry")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: "transparent", borderWidth: 1.5, borderColor: C.border }]}
            onPress={onFallbackPassword}
          >
            <Text style={[s.btnText, { color: C.text }]}>{t("biometricFallback")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
