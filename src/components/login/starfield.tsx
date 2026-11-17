import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

/**
 * Céu estrelado do hero do protrack-web (landing/Starfield.tsx): estrelas que
 * piscam e brilhos de 4 pontas que giram. Posições pseudo-aleatórias e fixas.
 */

// Mesmo hash do web, para o céu ter a mesma "cara".
const seeded = (i: number, salt: number) => {
  let t = (i * 2654435761 + salt * 1013904223) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) % 1000) / 1000;
};

const SPARKLE_PATH = "M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z";

/** 0 → 1 → 0 ao longo do ciclo (curva suave, como o ease-in-out do CSS). */
function wave(timeMs: number, durationS: number, delayS: number) {
  "worklet";
  const phase = ((timeMs / 1000 - delayS) / durationS) % 1;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
}

type Twinkle = { left: number; top: number; size: number; dur: number; delay: number };

const Star = memo(function Star({ star, time }: { star: Twinkle; time: SharedValue<number> }) {
  // @keyframes twinkle: opacidade 0.15 → 1 e escala 0.7 → 1.
  const style = useAnimatedStyle(() => {
    const k = wave(time.value, star.dur, star.delay);
    return { opacity: 0.15 + 0.85 * k, transform: [{ scale: 0.7 + 0.3 * k }] };
  });
  return (
    <Reanimated.View
      style={[
        styles.star,
        { left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size },
        style,
      ]}
    />
  );
});

const Sparkle = memo(function Sparkle({ star, time }: { star: Twinkle; time: SharedValue<number> }) {
  // @keyframes sparkle: some e aparece girando 90°.
  const style = useAnimatedStyle(() => {
    const k = wave(time.value, star.dur, star.delay);
    return { opacity: k, transform: [{ scale: 0.3 + 0.7 * k }, { rotate: `${90 * k}deg` }] };
  });
  return (
    <Reanimated.View style={[styles.abs, { left: `${star.left}%`, top: `${star.top}%` }, style]}>
      <Svg width={star.size} height={star.size} viewBox="0 0 24 24">
        <Path d={SPARKLE_PATH} fill="#ffffff" />
      </Svg>
    </Reanimated.View>
  );
});

const makeStars = (count: number): Twinkle[] =>
  Array.from({ length: count }, (_, i) => ({
    left: seeded(i, 1) * 100,
    top: seeded(i, 2) * 100,
    size: 1 + seeded(i, 3) * 2,
    dur: 3 + seeded(i, 4) * 4,
    delay: seeded(i, 5) * 6,
  }));

const makeSparkles = (count: number): Twinkle[] =>
  Array.from({ length: count }, (_, i) => ({
    left: 4 + seeded(i, 6) * 92,
    top: 4 + seeded(i, 7) * 80,
    size: 10 + seeded(i, 8) * 14,
    dur: 2.5 + seeded(i, 9) * 3,
    delay: seeded(i, 10) * 5,
  }));

export function Starfield({ stars = 45, sparkles = 6 }: { stars?: number; sparkles?: number }) {
  const reduceMotion = useReducedMotion();
  // Um relógio só para todas as estrelas; parado quando o sistema pede menos movimento.
  const time = useSharedValue(2500);
  useFrameCallback((frame) => {
    time.value = 2500 + frame.timeSinceFirstFrame;
  }, !reduceMotion);

  const starList = makeStars(stars);
  const sparkleList = makeSparkles(sparkles);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {starList.map((s, i) => (
        <Star key={`s${i}`} star={s} time={time} />
      ))}
      {sparkleList.map((s, i) => (
        <Sparkle key={`k${i}`} star={s} time={time} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  abs: { position: "absolute" },
  star: { position: "absolute", borderRadius: 9999, backgroundColor: "#ffffff" },
});
