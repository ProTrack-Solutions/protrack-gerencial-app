import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { StatusPill } from "@/components/ui/status-pill";
import type { ReturnListItem } from "@/interfaces/returns.interface";
import { formatDateTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";

import { KIND, methodLabel } from "./format";

/** Para onde foi o valor devolvido, em pedaços coloridos. */
export function outcomeParts(r: Pick<ReturnListItem, "kind" | "exchange_total" | "difference_paid" | "debt_reduction" | "credit_amount" | "refund_amount" | "refund_method">) {
  const parts: { text: string; className: string }[] = [];
  if (r.kind === "exchange") parts.push({ text: `levou ${formatCurrency(r.exchange_total)}`, className: "text-ink" });
  if (r.difference_paid > 0) parts.push({ text: `pagou ${formatCurrency(r.difference_paid)}`, className: "text-blue-700" });
  if (r.debt_reduction > 0) parts.push({ text: `abateu ${formatCurrency(r.debt_reduction)}`, className: "text-amber-700" });
  if (r.credit_amount > 0) parts.push({ text: `vale ${formatCurrency(r.credit_amount)}`, className: "text-pink-700" });
  if (r.refund_amount > 0)
    parts.push({ text: `devolvido ${formatCurrency(r.refund_amount)} (${methodLabel(r.refund_method).toLowerCase()})`, className: "text-emerald-700" });
  return parts;
}

export function ReturnCard({ item: r, onPress }: { item: ReturnListItem; onPress: () => void }) {
  const kind = KIND[r.kind];
  const parts = outcomeParts(r);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="gap-three rounded-three border border-line bg-paper p-three active:bg-surface">
      <View className="flex-row items-start gap-three">
        <View className={`h-10 w-10 items-center justify-center rounded-two ${r.kind === "exchange" ? "bg-brand-soft" : "bg-amber-50"}`}>
          <Ionicons name={kind.icon} size={20} color={r.kind === "exchange" ? "#3c87f7" : "#B45309"} />
        </View>
        <View className="flex-1 gap-half">
          <ThemedText className="font-bold" numberOfLines={1}>
            {r.customer_name || "Consumidor final"}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={1}>
            nº {r.number} · {formatDateTime(r.created_at)} · {r.items_count} {r.items_count === 1 ? "item" : "itens"}
          </ThemedText>
        </View>
        <View className="items-end gap-one">
          <StatusPill label={kind.label} tone={kind.tone} />
          {r.out_of_window && <StatusPill label="Fora do prazo" tone="danger" />}
        </View>
      </View>
      <View className="flex-row items-end justify-between gap-two">
        <View className="gap-half">
          <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
            VALOR DEVOLVIDO
          </ThemedText>
          <ThemedText className="font-bold">{formatCurrency(r.returned_total)}</ThemedText>
        </View>
        {parts.length > 0 && (
          <ThemedText type="small" className="flex-1 text-right text-xs" numberOfLines={2}>
            {parts.map((p, i) => (
              <ThemedText key={p.text} type="smallBold" className={`text-xs ${p.className}`}>
                {i > 0 ? " · " : ""}
                {p.text}
              </ThemedText>
            ))}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}
