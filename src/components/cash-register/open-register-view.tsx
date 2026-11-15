import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { SectionCard } from "@/components/sale/section-card";
import { ThemedText } from "@/components/themed-text";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Gradients } from "@/constants/theme";
import type { CashMovementType, CashRegister, CashSessionDetail } from "@/interfaces/cash-register.interface";
import { formatDuration, formatTime } from "@/utils/dates";
import { formatCurrency, formatNumber } from "@/utils/format";
import { haptics } from "@/utils/haptics";

import { CloseSheet, MovementSheet, TransferSheet } from "./cash-sheets";
import { PendingTransfers } from "./pending-transfers";
import { CashComposition, MethodBreakdown, MovementsList, OperatorBreakdown } from "./summary-parts";

type OpenRegisterViewProps = {
  register: CashRegister;
  /** Outros caixas ativos (o troco só vai para os que estão abertos). */
  registers: CashRegister[];
  detail: CashSessionDetail;
  onChange: (detail: CashSessionDetail) => void;
  onClosed: (detail: CashSessionDetail) => void;
};

/** Tempo de turno que avança sozinho a cada minuto. */
function useLiveDuration(startIso: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  return formatDuration(startIso);
}

export function OpenRegisterView({ register, registers, detail, onChange, onClosed }: OpenRegisterViewProps) {
  const { session, summary, movements } = detail;
  const [movement, setMovement] = useState<CashMovementType | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [closing, setClosing] = useState(false);
  const duration = useLiveDuration(session.opened_at);

  const targets = registers.filter((r) => r.id !== register.id && r.open_session);
  const pendingTransfers = (detail.incoming_transfers?.length ?? 0) + (detail.outgoing_transfers?.length ?? 0);

  const actions: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
    onPress: () => void;
    hidden?: boolean;
  }[] = [
    { label: "Suprimento", icon: "arrow-up-circle-outline", color: "#2F855A", bg: "bg-emerald-50", onPress: () => setMovement("supply") },
    { label: "Sangria", icon: "arrow-down-circle-outline", color: "#DC2626", bg: "bg-rose-50", onPress: () => setMovement("withdrawal") },
    { label: "Transferir", icon: "swap-horizontal", color: "#3c87f7", bg: "bg-[#EAF2FE]", onPress: () => setTransferring(true), hidden: targets.length === 0 },
    { label: "Nova venda", icon: "cart-outline", color: "#7C3AED", bg: "bg-[#F1ECFD]", onPress: () => router.push("/nova-venda") },
  ];

  return (
    <View className="gap-three">
      <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="gap-three rounded-four p-four">
        <View className="flex-row items-start justify-between gap-two">
          <View className="flex-1 gap-half">
            <View className="flex-row items-center gap-two">
              <ThemedText className="text-lg font-bold text-white">{register.name}</ThemedText>
              <View className="flex-row items-center gap-one rounded-full bg-white/20 px-two py-half">
                <View className="h-2 w-2 rounded-full bg-emerald-300" />
                <ThemedText type="smallBold" className="text-xs text-white">
                  Aberto
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" className="text-xs text-white/85">
              Por {session.user_name} às {formatTime(session.opened_at)} · há {duration}
            </ThemedText>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-two bg-white/20">
            <Ionicons name="wallet-outline" size={20} color="#ffffff" />
          </View>
        </View>
        <View className="gap-half">
          <ThemedText type="small" className="text-white/85">
            Esperado na gaveta
          </ThemedText>
          <ThemedText className="text-[28px] font-bold leading-9 text-white" numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(summary.expected_cash)}
          </ThemedText>
          <ThemedText type="small" className="text-xs text-white/85">
            Abertura de {formatCurrency(session.opening_amount)}
          </ThemedText>
        </View>
        <View className="flex-row gap-two">
          <View className="flex-1 gap-half rounded-three bg-white/15 p-three">
            <ThemedText type="small" className="text-xs text-white/85">
              Total recebido
            </ThemedText>
            <ThemedText className="font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(summary.received_total)}
            </ThemedText>
          </View>
          <View className="flex-1 gap-half rounded-three bg-white/15 p-three">
            <ThemedText type="small" className="text-xs text-white/85">
              Vendas no turno
            </ThemedText>
            <ThemedText className="font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
              {formatNumber(summary.sales_count)} · {formatCurrency(summary.sales_total)}
            </ThemedText>
          </View>
        </View>
      </LinearGradient>

      <SectionCard title="Ações do caixa" icon="flash-outline">
        <View className="flex-row justify-between">
          {actions
            .filter((a) => !a.hidden)
            .map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  haptics.tap();
                  action.onPress();
                }}
                accessibilityRole="button"
                className="flex-1 items-center gap-two active:opacity-70"
              >
                <View className={`h-14 w-14 items-center justify-center rounded-three ${action.bg}`}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <ThemedText type="smallBold" className="text-center text-xs leading-4" numberOfLines={1}>
                  {action.label}
                </ThemedText>
              </Pressable>
            ))}
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            setClosing(true);
          }}
          disabled={pendingTransfers > 0}
          accessibilityRole="button"
          accessibilityHint={pendingTransfers > 0 ? "Resolva as transferências pendentes antes de fechar" : undefined}
          className={`flex-row items-center justify-center gap-two rounded-two bg-ink py-three active:opacity-80 ${
            pendingTransfers > 0 ? "opacity-40" : ""
          }`}
        >
          <Ionicons name="lock-closed-outline" size={18} color="#ffffff" />
          <ThemedText type="smallBold" className="text-white">
            Fechar caixa
          </ThemedText>
        </Pressable>
      </SectionCard>

      <PendingTransfers detail={detail} onChange={onChange} />

      <SectionCard title="Dinheiro na gaveta" icon="cash-outline">
        <CashComposition openingAmount={session.opening_amount} summary={summary} />
      </SectionCard>

      <SectionCard title="Recebido por forma de pagamento" icon="card-outline">
        <MethodBreakdown summary={summary} />
      </SectionCard>

      <SectionCard title="Vendas por operador" icon="people-outline">
        <OperatorBreakdown summary={summary} />
      </SectionCard>

      <SectionCard
        title="Movimentações"
        icon="list-outline"
        right={
          movements?.length ? (
            <ThemedText type="smallBold" themeColor="textSecondary" className="text-xs">
              {movements.length}
            </ThemedText>
          ) : undefined
        }
      >
        <MovementsList movements={movements ?? []} />
      </SectionCard>

      <MovementSheet type={movement} expectedCash={summary.expected_cash} onClose={() => setMovement(null)} onDone={onChange} />
      <TransferSheet
        visible={transferring}
        targets={targets}
        expectedCash={summary.expected_cash}
        onClose={() => setTransferring(false)}
        onDone={onChange}
      />
      <CloseSheet
        visible={closing}
        detail={detail}
        onClose={() => setClosing(false)}
        onClosed={(closed) => {
          setClosing(false);
          onClosed(closed);
        }}
      />
    </View>
  );
}
