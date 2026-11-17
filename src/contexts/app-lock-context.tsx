import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Modal, Platform, Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Logo } from "@/components/ui/logo";
import { Gradients } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { haptics } from "@/utils/haptics";

const STORAGE_KEY = "protrack_biometric_lock";
/** Depois desse tempo em segundo plano, o app pede a biometria de novo. */
const LOCK_AFTER_MS = 60_000;

type BiometricSupport = { available: boolean; label: string };

type AppLockContextValue = {
  enabled: boolean;
  support: BiometricSupport;
  /** Liga (confirmando a biometria antes) ou desliga o bloqueio. Retorna se mudou. */
  setEnabled: (value: boolean) => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

async function detectSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") return { available: false, label: "Biometria" };
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  return {
    available: hardware && enrolled,
    label: face ? (Platform.OS === "ios" ? "Face ID" : "reconhecimento facial") : "impressão digital",
  };
}

const authenticate = (promptMessage: string) =>
  LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancelar",
    // Sem biometria cadastrada no momento, aceita o PIN/padrão do aparelho.
    disableDeviceFallback: false,
  });

/**
 * Bloqueia o app com a biometria do aparelho: ao abrir e ao voltar do segundo
 * plano depois de 1 minuto. A preferência fica salva no aparelho.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [support, setSupport] = useState<BiometricSupport>({ available: false, label: "Biometria" });
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    detectSupport()
      .then(setSupport)
      .catch(() => undefined);
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => {
        const on = value === "1";
        enabledRef.current = on;
        setEnabledState(on);
        if (on) setLocked(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (!enabledRef.current) return;
      if (state === "background") backgroundAt.current = Date.now();
      if (state === "active" && backgroundAt.current && Date.now() - backgroundAt.current > LOCK_AFTER_MS) setLocked(true);
      if (state === "active") backgroundAt.current = null;
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    const result = await authenticate("Desbloquear o ProTrack");
    if (result.success) {
      haptics.success();
      setLocked(false);
    } else {
      haptics.error();
    }
  }, []);

  // Pede a biometria assim que a tela de bloqueio aparece.
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      if (value) {
        const result = await authenticate(`Confirme para ativar o desbloqueio por ${support.label}`);
        if (!result.success) return false;
      }
      await SecureStore.setItemAsync(STORAGE_KEY, value ? "1" : "0");
      enabledRef.current = value;
      setEnabledState(value);
      haptics.success();
      return true;
    },
    [support.label],
  );

  const value = useMemo(() => ({ enabled, support, setEnabled }), [enabled, support, setEnabled]);

  return (
    <AppLockContext.Provider value={value}>
      {children}
      <Modal visible={locked} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => undefined}>
        <LinearGradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="flex-1 items-center justify-center gap-five px-five">
          <Logo width={96} />
          <View className="items-center gap-two">
            <ThemedText className="text-xl font-bold text-white">App bloqueado</ThemedText>
            <ThemedText type="small" className="text-center text-white/85">
              Use {support.label} para continuar.
            </ThemedText>
          </View>
          <Pressable
            onPress={unlock}
            accessibilityRole="button"
            className="flex-row items-center gap-two rounded-full bg-white px-five py-three active:opacity-80"
          >
            <Ionicons name="finger-print" size={22} color="#4896EA" />
            <ThemedText type="smallBold" className="text-[#4896EA]">
              Desbloquear
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={async () => {
              setLocked(false);
              await signOut();
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <ThemedText type="smallBold" className="text-white/85">
              Entrar com outra conta
            </ThemedText>
          </Pressable>
        </LinearGradient>
      </Modal>
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) throw new Error("useAppLock deve ser usado dentro de AppLockProvider");
  return context;
}
