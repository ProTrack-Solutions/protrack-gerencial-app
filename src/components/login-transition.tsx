import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { Image } from "@/components/ui/image";
import { BrandColor, BrandGreen, Gradients } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { loginTransition } from "@/utils/login-transition";

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

const COVER_MS = 720;
const REVEAL_MS = 820;
/** Tempo para o painel montar por baixo antes de o líquido escoar. */
const SETTLE_MS = 140;
/** Se a sessão não mudar (erro inesperado), o líquido escoa mesmo assim. */
const FAILSAFE_MS = 2500;
const MAX_WAVE = 34;
const SAMPLES = 28;
const MARK_SIZE = 96;

type Phase = "idle" | "covering" | "covered" | "revealing";

/**
 * Faixa de líquido com as bordas de cima e de baixo onduladas. `progress`
 * vai de 0 (abaixo da tela) a 1 (cobrindo tudo) e 2 (saiu por cima).
 * A onda fica mais alta no meio do movimento, como líquido em agitação.
 */
function liquidPath(
  progress: number,
  phase: number,
  width: number,
  height: number,
  lead: number,
  waves: number,
) {
  "worklet";
  const motion = Math.abs(Math.sin(Math.PI * progress));
  const amp = 8 + (MAX_WAVE - 8) * motion;
  // A camada de trás vai à frente na subida e atrás na saída: uma "crista" clara.
  const top = height * (1 - progress) - amp - lead * height;
  const bottom = height * (2 - progress) + amp + lead * height * 0.6;

  const edge = (base: number, shift: number) => {
    "worklet";
    const pts: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = (width * i) / SAMPLES;
      const t = (x / width) * Math.PI * 2 * waves;
      const y = base + amp * (0.7 * Math.sin(t + phase + shift) + 0.3 * Math.sin(2.3 * t - phase * 1.4));
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts;
  };

  const topPts = edge(top, 0);
  const bottomPts = edge(bottom, Math.PI * 0.6).reverse();
  return `M${topPts.join(" L")} L${bottomPts.join(" L")} Z`;
}

/**
 * Transição de entrada: ao confirmar o login o líquido "noite" sobe do pé da
 * tela, cobre o formulário com a marca no centro e, já com o painel montado
 * por baixo, continua subindo e escoa por cima revelando o app.
 */
export function LoginTransition() {
  const { status } = useAuth();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const resolveCover = useRef<(() => void) | null>(null);

  const progress = useSharedValue(0);
  const wobble = useSharedValue(0);
  const fade = useSharedValue(0);
  const mark = useSharedValue(0);

  const finishCover = useCallback(() => {
    setPhase("covered");
    resolveCover.current?.();
    resolveCover.current = null;
  }, []);

  const finishReveal = useCallback(() => {
    cancelAnimation(wobble);
    setPhase("idle");
  }, [wobble]);

  // O AuthProvider chama isso antes de trocar a sessão.
  useEffect(
    () =>
      loginTransition.register(
        () =>
          new Promise<void>((resolve) => {
            resolveCover.current = resolve;
            setPhase("covering");
            progress.value = 0;
            mark.value = 0;

            if (reduceMotion) {
              fade.value = 0;
              fade.value = withTiming(1, { duration: 200 }, (done) => {
                if (done) scheduleOnRN(finishCover);
              });
              return;
            }

            fade.value = 1;
            wobble.value = 0;
            wobble.value = withRepeat(withTiming(Math.PI * 2, { duration: 1100, easing: Easing.linear }), -1);
            progress.value = withTiming(1, { duration: COVER_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
              if (done) scheduleOnRN(finishCover);
            });
            mark.value = withTiming(1, { duration: COVER_MS, easing: Easing.in(Easing.quad) });
          }),
      ),
    [reduceMotion, progress, wobble, fade, mark, finishCover],
  );

  // Coberto e já autenticado: espera o painel montar e escoa o líquido.
  useEffect(() => {
    if (phase !== "covered") return;
    const reveal = () => {
      setPhase("revealing");
      if (reduceMotion) {
        fade.value = withTiming(0, { duration: 260 }, (done) => {
          if (done) scheduleOnRN(finishReveal);
        });
        return;
      }
      mark.value = withTiming(0, { duration: REVEAL_MS * 0.4, easing: Easing.out(Easing.quad) });
      progress.value = withTiming(2, { duration: REVEAL_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(finishReveal);
      });
    };
    const timer = setTimeout(reveal, status === "authenticated" ? SETTLE_MS : FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [phase, status, reduceMotion, progress, fade, mark, finishReveal]);

  const backProps = useAnimatedProps(() => ({
    d: liquidPath(progress.value, wobble.value + 1.2, width, height, 0.045, 1.3),
  }));
  const frontProps = useAnimatedProps(() => ({
    d: liquidPath(progress.value, wobble.value, width, height, 0, 1.1),
  }));
  const containerStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.7 + 0.3 * mark.value }, { translateY: (1 - mark.value) * 24 }],
  }));

  if (phase === "idle") return null;

  return (
    <Reanimated.View
      style={[StyleSheet.absoluteFill, { zIndex: 900 }, containerStyle]}
      // Bloqueia toques enquanto o líquido está subindo/cobrindo.
      pointerEvents={phase === "revealing" ? "none" : "auto"}
    >
      {reduceMotion ? (
        <Reanimated.View style={[StyleSheet.absoluteFill, { backgroundColor: Gradients.brand[1] }]} />
      ) : (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id="liquidCrest" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={BrandColor} />
              <Stop offset="1" stopColor={BrandGreen} />
            </SvgGradient>
            <SvgGradient id="liquidNight" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={Gradients.brand[2]} />
              <Stop offset="0.5" stopColor={Gradients.brand[1]} />
              <Stop offset="1" stopColor={Gradients.brand[0]} />
            </SvgGradient>
          </Defs>
          <AnimatedPath animatedProps={backProps} fill="url(#liquidCrest)" opacity={0.85} />
          <AnimatedPath animatedProps={frontProps} fill="url(#liquidNight)" />
        </Svg>
      )}
      <Reanimated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, markStyle]}>
        <Image source={require("@/assets/images/logo-mark.svg")} style={{ width: MARK_SIZE, height: MARK_SIZE }} contentFit="contain" />
      </Reanimated.View>
    </Reanimated.View>
  );
}
