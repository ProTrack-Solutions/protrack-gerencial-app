import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyInput } from "@/components/ui/money-input";
import type {
  CashMovementType,
  CashRegister,
  CashSessionDetail,
} from "@/interfaces/cash-register.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { CloseCashSession, CreateCashMovement, CreateCashTransfer } from "@/service/cash-register.service";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";

import { CashComposition, DifferenceBadge } from "./summary-parts";

const SUCCESS_GRADIENT = ["#10B981", "#34D399"] as const;
const DANGER_GRADIENT = ["#DC2626", "#F87171"] as const;

const MOVEMENT_COPY: Record<
  CashMovementType,
  { title: string; subtitle: string; placeholder: string; action: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  withdrawal: {
    title: "Sangria",
    subtitle: "Retirada de dinheiro da gaveta (depósito, pagamento, cofre).",
    placeholder: "Ex.: depósito no banco",
    action: "Registrar sangria",
    icon: "arrow-down-circle-outline",
  },
  supply: {
    title: "Suprimento",
    subtitle: "Reforço de dinheiro na gaveta, normalmente para troco.",
    placeholder: "Ex.: reforço de troco",
    action: "Registrar suprimento",
    icon: "arrow-up-circle-outline",
  },
};

/** Valores rápidos para sangria/suprimento: um toque em vez de digitar. */
const QUICK_AMOUNTS = [20, 50, 100, 200];

function QuickAmounts({ onPick, max }: { onPick: (value: number) => void; max?: number }) {
  return (
    <View className="flex-row flex-wrap gap-two">
      {QUICK_AMOUNTS.filter((v) => max === undefined || v <= max).map((value) => (
        <Pressable
          key={value}
          onPress={() => {
            haptics.select();
            onPick(value);
          }}
          accessibilityRole="button"
          className="rounded-full border border-line bg-paper px-three py-one active:bg-surface"
        >
          <ThemedText type="smallBold" className="text-xs">
            {formatCurrency(value).replace(",00", "")}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

type MovementSheetProps = {
  type: CashMovementType | null;
  expectedCash: number;
  onClose: () => void;
  onDone: (detail: CashSessionDetail) => void;
};

export function MovementSheet({ type, expectedCash, onClose, onDone }: MovementSheetProps) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const copy = MOVEMENT_COPY[type ?? "supply"];
  const tooMuch = type === "withdrawal" && amount > expectedCash;

  useEffect(() => {
    if (!type) return;
    setAmount(0);
    setReason("");
  }, [type]);

  const submit = async () => {
    if (!type || amount <= 0 || tooMuch) return haptics.warning();
    setSubmitting(true);
    try {
      const detail = await CreateCashMovement({ type, amount, reason: reason.trim() || undefined });
      haptics.success();
      onDone(detail);
      onClose();
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao registrar", getApiErrorMessage(error, "Não foi possível registrar a movimentação."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormSheet
      visible={type !== null}
      title={copy.title}
      subtitle={copy.subtitle}
      icon={copy.icon}
      colors={type === "withdrawal" ? DANGER_GRADIENT : SUCCESS_GRADIENT}
      onClose={onClose}
      submit={{
        label: submitting ? "Registrando..." : copy.action,
        icon: "checkmark-circle-outline",
        onPress: submit,
        loading: submitting,
        disabled: amount <= 0 || tooMuch,
      }}
    >
      <View className="gap-two">
        <FormLabel label="Valor" required />
        <MoneyInput value={amount} onChange={setAmount} autoFocus error={tooMuch ? "x" : undefined} />
        <QuickAmounts onPick={setAmount} max={type === "withdrawal" ? expectedCash : undefined} />
        {type === "withdrawal" && (
          <ThemedText type="small" className={`text-xs ${tooMuch ? "font-bold text-danger" : "text-muted"}`}>
            {tooMuch
              ? `Maior que o dinheiro esperado na gaveta (${formatCurrency(expectedCash)}).`
              : `Esperado na gaveta agora: ${formatCurrency(expectedCash)}.`}
          </ThemedText>
        )}
      </View>
      <View className="gap-two">
        <FormLabel label="Motivo" icon="chatbubble-outline" />
        <FormInput placeholder={copy.placeholder} value={reason} onChangeText={setReason} maxLength={500} />
      </View>
    </FormSheet>
  );
}

type TransferSheetProps = {
  visible: boolean;
  targets: CashRegister[];
  expectedCash: number;
  onClose: () => void;
  onDone: (detail: CashSessionDetail) => void;
};

export function TransferSheet({ visible, targets, expectedCash, onClose, onDone }: TransferSheetProps) {
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tooMuch = amount > expectedCash;
  const target = targets.find((t) => t.id === toId);

  useEffect(() => {
    if (!visible) return;
    setToId(targets.length === 1 ? targets[0].id : "");
    setAmount(0);
    setReason("");
  }, [visible, targets]);

  const submit = async () => {
    if (!toId || amount <= 0 || tooMuch) return haptics.warning();
    setSubmitting(true);
    try {
      const detail = await CreateCashTransfer({ to_register_id: toId, amount, reason: reason.trim() || undefined });
      haptics.success();
      onDone(detail);
      onClose();
      Alert.alert("Troco enviado", `${formatCurrency(amount)} enviados. Aguardando o ${target?.name ?? "outro caixa"} aceitar.`);
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao transferir", getApiErrorMessage(error, "Não foi possível transferir o troco."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Transferir troco"
      subtitle="O dinheiro sai desta gaveta agora; se o outro caixa recusar, ele volta."
      icon="swap-horizontal"
      onClose={onClose}
      submit={{
        label: submitting ? "Enviando..." : target ? `Enviar para ${target.name}` : "Escolha o caixa",
        icon: "send-outline",
        onPress: submit,
        loading: submitting,
        disabled: !toId || amount <= 0 || tooMuch,
      }}
    >
      <View className="gap-two">
        <FormLabel label="Para qual caixa" required />
        {targets.map((t) => {
          const selected = t.id === toId;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                haptics.select();
                setToId(t.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-three rounded-two border p-three active:opacity-70 ${
                selected ? "border-brand bg-brand-soft" : "border-line bg-paper"
              }`}
            >
              <Ionicons name="desktop-outline" size={18} color={selected ? "#3c87f7" : "#60646C"} />
              <View className="flex-1">
                <ThemedText type="smallBold" className={selected ? "text-brand" : ""}>
                  {t.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                  Aberto por {t.open_session?.opened_by_name}
                </ThemedText>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={20} color="#3c87f7" />}
            </Pressable>
          );
        })}
      </View>
      <View className="gap-two">
        <FormLabel label="Valor" required />
        <MoneyInput value={amount} onChange={setAmount} error={tooMuch ? "x" : undefined} />
        <ThemedText type="small" className={`text-xs ${tooMuch ? "font-bold text-danger" : "text-muted"}`}>
          {tooMuch
            ? `Maior que o dinheiro esperado na gaveta (${formatCurrency(expectedCash)}).`
            : `Esperado na gaveta agora: ${formatCurrency(expectedCash)}.`}
        </ThemedText>
      </View>
      <View className="gap-two">
        <FormLabel label="Observação" icon="chatbubble-outline" />
        <FormInput placeholder="Ex.: moedas de R$ 1 e notas de R$ 5" value={reason} onChangeText={setReason} maxLength={500} />
      </View>
    </FormSheet>
  );
}

type CloseSheetProps = {
  visible: boolean;
  detail: CashSessionDetail;
  onClose: () => void;
  /** Recebe o turno fechado, para mostrar o relatório. */
  onClosed: (detail: CashSessionDetail) => void;
};

export function CloseSheet({ visible, detail, onClose, onClosed }: CloseSheetProps) {
  const [counted, setCounted] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expected = detail.summary.expected_cash;
  const difference = counted === null ? null : counted - expected;
  const mismatch = difference !== null && Math.abs(difference) >= 0.005;

  useEffect(() => {
    if (!visible) return;
    setCounted(null);
    setNotes("");
  }, [visible]);

  const close = async () => {
    if (counted === null) return;
    setSubmitting(true);
    try {
      const closed = await CloseCashSession({ counted_cash: counted, notes: notes.trim() || undefined });
      haptics.success();
      onClosed(closed);
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao fechar", getApiErrorMessage(error, "Não foi possível fechar o caixa."));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = () => {
    if (counted === null) return haptics.warning();
    if (!mismatch) return close();
    haptics.warning();
    const label = difference > 0 ? "sobra" : "falta";
    Alert.alert(
      "Conferência com diferença",
      `Há ${label} de ${formatCurrency(Math.abs(difference))} na gaveta.${notes.trim() ? "" : " Considere explicar na observação."} Fechar mesmo assim?`,
      [
        { text: "Revisar", style: "cancel" },
        { text: "Fechar caixa", style: "destructive", onPress: close },
      ],
    );
  };

  return (
    <FormSheet
      visible={visible}
      title="Fechar caixa"
      subtitle="Conte o dinheiro da gaveta. Cartão e Pix não entram na contagem."
      icon="lock-closed-outline"
      onClose={onClose}
      submit={{
        label: submitting ? "Fechando..." : "Confirmar fechamento",
        icon: "lock-closed-outline",
        onPress: submit,
        loading: submitting,
        disabled: counted === null,
      }}
    >
      <View className="rounded-three border border-line bg-field p-three">
        <CashComposition openingAmount={detail.session.opening_amount} summary={detail.summary} />
      </View>

      <View className="gap-two">
        <View className="flex-row items-center justify-between">
          <FormLabel label="Dinheiro contado" required />
          {difference !== null && <DifferenceBadge value={difference} />}
        </View>
        <MoneyInput value={counted ?? 0} onChange={setCounted} autoFocus />
        <Pressable
          onPress={() => {
            haptics.select();
            setCounted(expected);
          }}
          accessibilityRole="button"
          className="self-start rounded-full bg-brand-soft px-three py-one active:opacity-70"
        >
          <ThemedText type="smallBold" className="text-xs text-brand">
            Usar o valor esperado ({formatCurrency(expected)})
          </ThemedText>
        </Pressable>
      </View>

      <View className="gap-two">
        <FormLabel label={mismatch ? "Observação (explique a diferença)" : "Observação"} icon="chatbubble-outline" />
        <FormInput
          placeholder="Opcional"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={500}
          error={mismatch && !notes.trim() ? "x" : undefined}
        />
        {mismatch && !notes.trim() && <FieldError message="Recomendado quando a contagem não confere." />}
      </View>
    </FormSheet>
  );
}
