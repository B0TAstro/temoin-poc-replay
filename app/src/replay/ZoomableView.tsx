import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 6;

/** Pinch to zoom, drag to pan while zoomed, double tap to reset. Runs on the UI thread. */
export function ZoomableView({ children }: { children: ReactNode }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
    },
    onDeactivate: () => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    },
  });

  const pan = usePanGesture({
    minPointers: 1,
    maxPointers: 2,
    onUpdate: (e) => {
      if (scale.value <= 1) return;
      translateX.value = savedX.value + e.translationX / scale.value;
      translateY.value = savedY.value + e.translationY / scale.value;
    },
    onDeactivate: () => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedX.value = 0;
      savedY.value = 0;
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
});
