import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { StatusPill } from "@/components/ui/status-pill";
import type { PurchaseOrderListItem } from "@/interfaces/purchases.interface";
import { formatDate } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";

import { ORDER_STATUS } from "./format";

/** Barra de progresso do recebimento (recebido / pedido). */
export function ReceiveProgress({ received, total }: { received: number; total: number }) {
  const ratio = total > 0 ? Math.min(received / total, 1) : 0;
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-surface">
      <View className={`h-full rounded-full ${ratio >= 1 ? "bg-emerald-500" : "bg-brand"}`} style={{ width: `${ratio * 100}%` }} />
    </View>
  );
}

export function OrderCard({ order: o, onPress }: { order: PurchaseOrderListItem; onPress: () => void }) {
  const status = ORDER_STATUS[o.status];
  const showProgress = o.status === "partial" || o.status === "sent" || o.status === "received";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`gap-three rounded-three border bg-paper p-three active:bg-surface ${o.late ? "border-rose-200" : "border-line"}`}
    >
      <View className="flex-row items-start gap-two">
        <View className="flex-1 gap-half">
          <ThemedText className="font-bold" numberOfLines={1}>
            {o.vendor_name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            Pedido nº {o.number} · {o.items_count} {o.items_count === 1 ? "item" : "itens"}
          </ThemedText>
        </View>
        <StatusPill label={status.label} tone={status.tone} />
      </View>

      <View className="flex-row gap-two">
        <View className="flex-1 gap-half">
          <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
            TOTAL
          </ThemedText>
          <ThemedText type="smallBold">{formatCurrency(o.total)}</ThemedText>
        </View>
        <View className="flex-1 gap-half">
          <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
            PREVISÃO
          </ThemedText>
          <ThemedText type="small" className={o.late ? "font-bold text-danger" : ""}>
            {o.expected_date ? formatDate(o.expected_date) : "—"}
          </ThemedText>
        </View>
        <View className="flex-1 gap-half">
          <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
            RECEBIDO
          </ThemedText>
          <ThemedText type="small">
            {o.received_quantity}/{o.quantity}
          </ThemedText>
        </View>
      </View>

      {showProgress && <ReceiveProgress received={o.received_quantity} total={o.quantity} />}
      {o.late && (
        <ThemedText type="smallBold" className="text-xs text-danger">
          Atrasado
        </ThemedText>
      )}
    </Pressable>
  );
}
