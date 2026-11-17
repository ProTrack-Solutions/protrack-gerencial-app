import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { GradientButton } from "@/components/login/gradient-button";
import { FormInput, FormLabel } from "@/components/product/form-field";
import { ThemedText } from "@/components/themed-text";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { MoneyInput } from "@/components/ui/money-input";
import { Gradients } from "@/constants/theme";
import type { CashRegister, CashSessionDetail } from "@/interfaces/cash-register.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { OpenCashSession } from "@/service/cash-register.service";
import { formatDateTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";

type OpenRegisterCardProps = {
  register: CashRegister;
  onOpened: (detail: CashSessionDetail) => void;
};

/** Abertura do turno do caixa deste aparelho. */
export function OpenRegisterCard({ register, onOpened }: OpenRegisterCardProps) {
  const last = register.last_closing;
  const lastCounted = last?.counted_cash ?? 0;
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const detail = await OpenCashSession({ opening_amount: amount, notes: notes.trim() || undefined });
      haptics.success();
      onOpened(detail);
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao abrir o caixa", getApiErrorMessage(error, "Não foi possível abrir o caixa."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="overflow-hidden rounded-four border border-line bg-paper">
      <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="gap-three p-four">
        <View className="h-12 w-12 items-center justify-center rounded-three bg-white/20">
          <Ionicons name="lock-closed-outline" size={24} color="#ffffff" />
        </View>
        <View className="gap-one">
          <ThemedText className="text-xl font-bold text-white">{register.name} está fechado</ThemedText>
          <ThemedText type="small" className="text-white/85">
            Abra o turno para começar a vender neste caixa. No fim do dia é só contar a gaveta e fechar.
          </ThemedText>
        </View>
        <View className="flex-row items-start gap-two">
          <Ionicons name="people-outline" size={16} color="#ffffff" />
          <ThemedText type="small" className="flex-1 text-xs text-white/90">
            O turno é do caixa: qualquer funcionário vende, faz sangria e pode fechar.
          </ThemedText>
        </View>
      </LinearGradient>

      <View className="gap-four p-four">
        {last && (
          <View className="gap-one rounded-three border border-line bg-field p-three">
            <ThemedText type="smallBold">Último fechamento</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(last.closed_at)}
              {last.closed_by_name ? ` por ${last.closed_by_name}` : ""} · contado{" "}
              <ThemedText type="smallBold">{formatCurrency(lastCounted)}</ThemedText>
            </ThemedText>
            {lastCounted > 0 && amount !== lastCounted && (
              <Pressable
                onPress={() => {
                  haptics.select();
                  setAmount(lastCounted);
                }}
                accessibilityRole="button"
                className="mt-one self-start rounded-full bg-brand-soft px-three py-one active:opacity-70"
              >
                <ThemedText type="smallBold" className="text-xs text-brand">
                  O dinheiro ficou na gaveta? Usar {formatCurrency(lastCounted)}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        <View className="gap-two">
          <FormLabel label="Valor inicial na gaveta" icon="cash-outline" />
          <MoneyInput value={amount} onChange={setAmount} />
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            O dinheiro de troco que já está no caixa. Pode ser R$ 0,00.
          </ThemedText>
        </View>

        <View className="gap-two">
          <FormLabel label="Observação" icon="chatbubble-outline" />
          <FormInput
            placeholder="Ex.: troco conferido com a gerente"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
        </View>

        <GradientButton
          label={submitting ? "Abrindo..." : `Abrir ${register.name}`}
          icon="lock-open-outline"
          colors={Gradients.primary}
          disabled={submitting}
          onPress={submit}
          className={submitting ? "opacity-60" : ""}
        />
      </View>
    </View>
  );
}
