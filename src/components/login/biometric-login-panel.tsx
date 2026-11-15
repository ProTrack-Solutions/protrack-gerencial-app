import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { GradientButton } from "@/components/login/gradient-button";
import { ThemedText } from "@/components/themed-text";
import type { BiometricProfile, BiometricSupport } from "@/utils/biometrics";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** "gabriel@empresa.com" -> "ga•••@empresa.com" */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}•••@${domain}`;
}

type Props = {
  profile: BiometricProfile;
  support: BiometricSupport;
  loading: boolean;
  error: string | null;
  onBiometric: () => void;
  onUsePassword: () => void;
  onSwitchAccount: () => void;
};

/** Entrada estilo app de banco: "Olá, Fulano" e um toque na biometria. */
export function BiometricLoginPanel({ profile, support, loading, error, onBiometric, onUsePassword, onSwitchAccount }: Props) {
  const firstName = profile.name.split(" ")[0] || profile.name;
  const icon = support.face ? "scan-outline" : "finger-print";

  return (
    <View className="items-center gap-four">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
        <ThemedText className="text-xl font-bold text-brand">{initials(profile.name)}</ThemedText>
      </View>
      <View className="items-center gap-one">
        <ThemedText type="subtitle" className="text-2xl leading-[30px]">
          Olá, {firstName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {maskEmail(profile.email)}
        </ThemedText>
      </View>

      <Pressable
        onPress={onBiometric}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={`Entrar com ${support.label}`}
        className="h-24 w-24 items-center justify-center rounded-full border-2 border-brand-line bg-brand-soft active:opacity-70"
      >
        <Ionicons name={icon} size={48} color="#7C4FE0" />
      </Pressable>

      {error && (
        <View className="w-full flex-row items-center gap-two rounded-two bg-[#FEECEC] px-three py-two">
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <ThemedText type="small" className="flex-1" style={{ color: "#B91C1C" }}>
            {error}
          </ThemedText>
        </View>
      )}

      <View className="w-full">
        <GradientButton
          label={loading ? "Entrando..." : `Entrar com ${support.label}`}
          icon={support.face ? "scan-outline" : "finger-print-outline"}
          disabled={loading}
          className={loading ? "opacity-70" : undefined}
          onPress={onBiometric}
        />
      </View>

      <Pressable onPress={onUsePassword} hitSlop={8} accessibilityRole="button">
        <ThemedText type="linkPrimary">Entrar com senha</ThemedText>
      </Pressable>
      <Pressable onPress={onSwitchAccount} hitSlop={8} accessibilityRole="button">
        <ThemedText type="small" themeColor="textSecondary">
          Não é você? <ThemedText type="smallBold" themeColor="textSecondary">Usar outra conta</ThemedText>
        </ThemedText>
      </Pressable>
    </View>
  );
}
