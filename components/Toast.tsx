import React, { useEffect, useRef } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from "react-native-reanimated";

interface Props {
  message: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
  type?: "success" | "error" | "info";
}

export function Toast({ message, visible, onHide, duration = 2000, type = "success" }: Props) {
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
      // Auto-hide
      translateY.value = withDelay(duration, withTiming(-80, { duration: 300 }, () => {
        runOnJS(onHide)();
      }));
      opacity.value = withDelay(duration, withTiming(0, { duration: 300 }));
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const bgColor = type === "success" ? "#22C55E" : type === "error" ? "#EF4444" : "#3B82F6";
  const icon = type === "success" ? "\u2713" : type === "error" ? "\u2715" : "\u2139";

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }, animStyle]} pointerEvents="none">
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 55,
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: { color: "#fff", fontSize: 16, fontWeight: "800" },
  text: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1 },
});
