import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/login/gradient-button";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/contexts/auth-context";
import { declineBiometricLogin } from "@/utils/biometrics";
import { haptics } from "@/utils/haptics";

const BENEFITS = [
  { icon: "flash-outline", text: "Entre em um segundo, sem digitar a senha." },
  { icon: "shield-checkmark-outline", text: "A senha fica criptografada só neste aparelho." },
  { icon: "settings-outline", text: "Dá para desligar quando quiser em Configurações > Segurança." },
] as const;

/** Pergunta, logo depois do login com senha, se a pessoa quer entrar com biometria. */
export function BiometricOfferSheet() {
  const insets = useSafeAreaInsets();
  const { biometric } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offer = biometric.offer;
  const label = biometric.support.label;
  const icon = biometric.support.face ? "scan-outline" : "finger-print";

  const accept = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await biometric.acceptOffer();
      if (ok) haptics.success();
      else {
        haptics.warning();
        setError(`Não foi possível confirmar ${label}. Tente de novo.`);
      }
    } catch {
      haptics.error();
      setError("Não foi possível ativar agora. Tente de novo em Configurações > Segurança.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setError(null);
    biometric.dismissOffer();
  };

  const neverAsk = async () => {
    if (offer) await declineBiometricLogin(offer.email);
    close();
  };

  return (
    <Modal visible={Boolean(offer)} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={busy ? undefined : close}>
      <Pressable className="flex-1 bg-black/40" onPress={busy ? undefined : close} accessibilityLabel="Fechar" />
      <View className="items-center gap-four rounded-t-four bg-paper px-five pt-five" style={{ paddingBottom: insets.bottom + 24 }}>
        <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-soft">
          <Ionicons name={icon} size={40} color="#7C4FE0" />
        </View>
        <View className="items-center gap-one">
          <ThemedText className="text-center text-xl font-bold">Entrar com {label}?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-center">
            {offer ? `Nas próximas vezes, ${offer.name.split(" ")[0]}, use ${label} para entrar no ProTrack.` : ""}
          </ThemedText>
        </View>

        <View className="w-full gap-two">
          {BENEFITS.map((b) => (
            <View key={b.text} className="flex-row items-center gap-three rounded-two bg-surface p-three">
              <Ionicons name={b.icon} size={18} color="#7C4FE0" />
              <ThemedText type="small" className="flex-1">
                {b.text}
              </ThemedText>
            </View>
          ))}
        </View>

        {error && (
          <ThemedText type="small" className="text-center text-danger">
            {error}
          </ThemedText>
        )}

        <View className="w-full">
          <GradientButton
            label={busy ? "Confirmando..." : `Ativar ${label}`}
            icon={biometric.support.face ? "scan-outline" : "finger-print-outline"}
            disabled={busy}
            className={busy ? "opacity-70" : undefined}
            onPress={accept}
          />
        </View>
        <Pressable onPress={close} disabled={busy} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" themeColor="textSecondary">
            Agora não
          </ThemedText>
        </Pressable>
        <Pressable onPress={neverAsk} disabled={busy} hitSlop={8} accessibilityRole="button">
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            Não perguntar de novo
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}
