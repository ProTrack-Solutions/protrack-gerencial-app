import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { ThemedText } from "@/components/themed-text";
import { Image } from "@/components/ui/image";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Gradients } from "@/constants/theme";

/** Mesmo tamanho da marca na splash nativa (app.json: imageWidth). */
const MARK_SIZE = 116;
const EASE = Easing.out(Easing.cubic);

/**
 * Continua a splash nativa (marca no centro, fundo da cor do meio do gradiente):
 * o gradiente da marca aparece, o nome "ProTrack Gerencial" sobe por baixo da
 * marca e a tela some revelando o app.
 */
export function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const markScale = useSharedValue(1);
  const markY = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(16);
  const overlay = useSharedValue(1);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    markScale.value = withTiming(0.82, { duration: 500, easing: EASE });
    markY.value = withTiming(-36, { duration: 500, easing: EASE });
    textOpacity.value = withDelay(180, withTiming(1, { duration: 420, easing: EASE }));
    textY.value = withDelay(180, withTiming(0, { duration: 420, easing: EASE }));
    overlay.value = withDelay(
      1150,
      withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(setVisible, false);
      }),
    );
  }, [markScale, markY, textOpacity, textY, overlay]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
    transform: [{ scale: 1 + (1 - overlay.value) * 0.06 }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: markY.value }, { scale: markScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  if (!visible) return null;

  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, { zIndex: 1000 }, overlayStyle]} pointerEvents="none">
      <LinearGradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} className="items-center justify-center">
        <Reanimated.View style={markStyle}>
          <Image source={require("@/assets/images/logo-mark.svg")} style={{ width: MARK_SIZE, height: MARK_SIZE }} contentFit="contain" />
        </Reanimated.View>
        <Reanimated.View style={[{ position: "absolute", top: "50%", marginTop: MARK_SIZE / 2 - 8 }, textStyle]} className="items-center">
          <ThemedText className="text-[34px] font-bold leading-[40px] text-white">ProTrack</ThemedText>
          <ThemedText className="text-sm font-semibold tracking-[8px] text-[#7FD3F0]">GERENCIAL</ThemedText>
        </Reanimated.View>
      </View>
    </Reanimated.View>
  );
}
