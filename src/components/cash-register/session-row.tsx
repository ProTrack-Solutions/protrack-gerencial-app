import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { StatusPill } from "@/components/ui/status-pill";
import type { CashSession } from "@/interfaces/cash-register.interface";
import { formatDateTime, formatDuration } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";

import { DifferenceBadge } from "./summary-parts";

type SessionRowProps = {
  session: CashSession;
  showRegister: boolean;
  onPress: () => void;
};

export function SessionRow({ session: s, showRegister, onPress }: SessionRowProps) {
  const open = s.status === "open";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="gap-two rounded-three border border-line bg-paper p-three active:bg-surface"
    >
      <View className="flex-row items-start gap-two">
        <View className="flex-1 gap-half">
          <ThemedText className="font-bold" numberOfLines={1}>
            {formatDateTime(s.opened_at)}
            {showRegister && s.register_name ? ` · ${s.register_name}` : ""}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={1}>
            {s.user_name ? `${s.user_name} · ` : ""}
            {formatDuration(s.opened_at, s.closed_at)}
            {!open ? ` · ${s.sales_count ?? 0} ${s.sales_count === 1 ? "venda" : "vendas"}` : ""}
          </ThemedText>
        </View>
        {open ? <StatusPill label="Aberto" tone="brand" dot /> : <DifferenceBadge value={s.difference ?? 0} />}
        <Ionicons name="chevron-forward" size={18} color="#8B8D98" />
      </View>
      {!open && (
        <View className="flex-row gap-two">
          {[
            { label: "VENDAS", value: s.sales_total ?? 0 },
            { label: "ESPERADO", value: s.expected_cash ?? 0 },
            { label: "CONTADO", value: s.counted_cash ?? 0 },
          ].map((v) => (
            <View key={v.label} className="flex-1 gap-half">
              <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
                {v.label}
              </ThemedText>
              <ThemedText type="small" numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(v.value)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}
