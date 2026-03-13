import React, { useRef } from "react";
import { Animated, Dimensions, I18nManager, PanResponder, StyleSheet, View } from "react-native";
import { router } from "expo-router";

const SCREEN_WIDTH = Dimensions.get("window").width;
const EDGE_WIDTH = 30;
const THRESHOLD = SCREEN_WIDTH * 0.3;

/**
 * Wraps children with a right-edge swipe-back gesture for RTL mode.
 * In LTR mode, renders children directly (native gesture handles it).
 */
export function RTLSwipeBack({ children }: { children: React.ReactNode }) {
  if (!I18nManager.isRTL) return <>{children}</>;

  const translateX = useRef(new Animated.Value(0)).current;
  const gestureActive = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => {
        // Only respond to touches starting near the right edge
        return gs.x0 > SCREEN_WIDTH - EDGE_WIDTH;
      },
      onMoveShouldSetPanResponder: (_, gs) => {
        // Swipe must be right-to-left (negative dx) and more horizontal than vertical
        return gs.x0 > SCREEN_WIDTH - EDGE_WIDTH && gs.dx < -10 && Math.abs(gs.dx) > Math.abs(gs.dy);
      },
      onPanResponderGrant: () => {
        gestureActive.current = true;
      },
      onPanResponderMove: (_, gs) => {
        // Only track leftward movement (negative dx → screen slides left)
        if (gs.dx < 0) {
          translateX.setValue(gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        gestureActive.current = false;
        if (gs.dx < -THRESHOLD || gs.vx < -0.5) {
          // Swipe far enough or fast enough — navigate back
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            router.back();
            translateX.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        gestureActive.current = false;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View style={[styles.container, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
