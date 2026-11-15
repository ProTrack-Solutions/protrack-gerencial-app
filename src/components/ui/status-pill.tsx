import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";

export type PillTone = "neutral" | "brand" | "success" | "warning" | "danger" | "violet" | "solidSuccess";

const TONES: Record<PillTone, { box: string; text: string; dot: string }> = {
  neutral: { box: "bg-surface border-line", text: "text-muted", dot: "bg-muted" },
  brand: { box: "bg-brand-soft border-brand-line", text: "text-brand", dot: "bg-brand" },
  success: { box: "bg-emerald-50 border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500" },
  warning: { box: "bg-amber-50 border-amber-300", text: "text-amber-700", dot: "bg-amber-500" },
  danger: { box: "bg-rose-50 border-rose-300", text: "text-rose-700", dot: "bg-rose-500" },
  violet: { box: "bg-violet-50 border-violet-300", text: "text-violet-700", dot: "bg-violet-500" },
  solidSuccess: { box: "bg-emerald-500 border-emerald-500", text: "text-white", dot: "bg-white" },
};

/** Etiqueta arredondada de status (mesmo visual das parcelas em Contas a Receber). */
export function StatusPill({ label, tone = "neutral", dot }: { label: string; tone?: PillTone; dot?: boolean }) {
  const style = TONES[tone];
  return (
    <View className={`flex-row items-center gap-one rounded-full border px-two py-half ${style.box}`}>
      {dot && <View className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />}
      <ThemedText type="smallBold" className={`text-xs ${style.text}`}>
        {label}
      </ThemedText>
    </View>
  );
}
