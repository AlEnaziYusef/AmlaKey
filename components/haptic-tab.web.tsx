import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';

// Web: no haptics, just a regular pressable
export function HapticTab(props: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} />;
}
