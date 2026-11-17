import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type {
  CashSessionDetail,
  CashTransferAction,
  PendingCashTransfer,
} from "@/interfaces/cash-register.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { ResolveCashTransfer } from "@/service/cash-register.service";
import { formatTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";

const DONE: Record<CashTransferAction, string> = {
  accept: "Troco recebido e lançado na gaveta.",
  reject: "Transferência recusada: o dinheiro volta para o caixa de origem.",
  cancel: "Transferência cancelada: o dinheiro voltou para esta gaveta.",
};

type PendingTransfersProps = {
  detail: CashSessionDetail;
  onChange: (detail: CashSessionDetail) => void;
};

/** Troco chegando (aceitar/recusar) e saindo (aguardando) deste caixa. */
export function PendingTransfers({ detail, onChange }: PendingTransfersProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const incoming = detail.incoming_transfers ?? [];
  const outgoing = detail.outgoing_transfers ?? [];
  if (incoming.length === 0 && outgoing.length === 0) return null;

  const act = async (transfer: PendingCashTransfer, action: CashTransferAction) => {
    setBusyId(transfer.id);
    try {
      const next = await ResolveCashTransfer(transfer.id, action);
      haptics.success();
      onChange(next);
      Alert.alert("Pronto", DONE[action]);
    } catch (error) {
      haptics.error();
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível atualizar a transferência."));
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (transfer: PendingCashTransfer, action: CashTransferAction) => {
    if (action === "accept") return act(transfer, action);
    haptics.warning();
    Alert.alert(
      action === "reject" ? "Recusar troco?" : "Cancelar transferência?",
      action === "reject"
        ? `${formatCurrency(transfer.amount)} voltam para o ${transfer.from_register_name}.`
        : `${formatCurrency(transfer.amount)} voltam para esta gaveta.`,
      [
        { text: "Voltar", style: "cancel" },
        { text: action === "reject" ? "Recusar" : "Cancelar envio", style: "destructive", onPress: () => act(transfer, action) },
      ],
    );
  };

  const row = (t: PendingCashTransfer, isIncoming: boolean) => {
    const busy = busyId === t.id;
    return (
      <View key={t.id} className="gap-three rounded-three border border-line bg-paper p-three">
        <View className="flex-row items-center gap-three">
          <View className={`h-9 w-9 items-center justify-center rounded-two ${isIncoming ? "bg-emerald-50" : "bg-amber-50"}`}>
            <Ionicons name={isIncoming ? "arrow-down" : "arrow-up"} size={18} color={isIncoming ? "#2F855A" : "#B45309"} />
          </View>
          <View className="flex-1">
            <ThemedText type="smallBold">
              {isIncoming
                ? `${t.from_register_name} enviou ${formatCurrency(t.amount)}`
                : `${formatCurrency(t.amount)} para ${t.to_register_name}`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={2}>
              {isIncoming
                ? `Por ${t.created_by_name} às ${formatTime(t.created_at)}`
                : `Aguardando aceitar · enviado às ${formatTime(t.created_at)}`}
              {t.reason ? ` · ${t.reason}` : ""}
            </ThemedText>
          </View>
        </View>
        {busy ? (
          <ActivityIndicator />
        ) : isIncoming ? (
          <View className="flex-row gap-two">
            <Pressable
              onPress={() => confirm(t, "reject")}
              accessibilityRole="button"
              className="flex-1 items-center rounded-two border border-line bg-paper py-two active:bg-surface"
            >
              <ThemedText type="smallBold">Recusar</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => confirm(t, "accept")}
              accessibilityRole="button"
              className="flex-1 flex-row items-center justify-center gap-one rounded-two bg-emerald-600 py-two active:opacity-80"
            >
              <Ionicons name="checkmark" size={16} color="#ffffff" />
              <ThemedText type="smallBold" className="text-white">
                Recebi, aceitar
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => confirm(t, "cancel")}
            accessibilityRole="button"
            className="items-center rounded-two border border-line bg-paper py-two active:bg-surface"
          >
            <ThemedText type="smallBold">Cancelar envio</ThemedText>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View className="gap-two rounded-three border border-amber-300 bg-amber-50 p-three">
      <View className="flex-row items-center gap-two">
        <Ionicons name="time-outline" size={18} color="#B45309" />
        <ThemedText type="smallBold">Transferências de troco pendentes</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" className="text-xs">
        O caixa só pode ser fechado depois que elas forem aceitas, recusadas ou canceladas.
      </ThemedText>
      {incoming.map((t) => row(t, true))}
      {outgoing.map((t) => row(t, false))}
    </View>
  );
}
