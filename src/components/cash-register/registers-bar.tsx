import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { CashRegister } from "@/interfaces/cash-register.interface";
import { formatTime } from "@/utils/dates";
import { haptics } from "@/utils/haptics";

type RegistersBarProps = {
  registers: CashRegister[];
  selectedId?: string;
  needsChoice: boolean;
  onChoose: (id: string) => void;
};

/**
 * Situação de todos os caixas da loja, com o deste aparelho em destaque.
 * Só aparece com mais de um caixa ativo; sem escolha, vira a pergunta
 * "em qual caixa você está?".
 */
export function RegistersBar({ registers, selectedId, needsChoice, onChoose }: RegistersBarProps) {
  if (registers.length < 2) return null;

  return (
    <View className={`gap-two ${needsChoice ? "rounded-three border border-brand-line bg-brand-soft p-three" : ""}`}>
      <View className="gap-half">
        <ThemedText type="smallBold">{needsChoice ? "Em qual caixa este aparelho trabalha?" : "Caixas da loja"}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-xs">
          {needsChoice
            ? "As vendas feitas aqui entram no turno do caixa escolhido. A escolha fica salva no aparelho."
            : "Toque em outro caixa para trabalhar nele."}
        </ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-three" contentContainerClassName="gap-two px-three">
        {registers.map((r) => {
          const mine = r.id === selectedId;
          const open = r.open_session;
          return (
            <Pressable
              key={r.id}
              onPress={() => {
                if (mine) return;
                haptics.select();
                onChoose(r.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: mine }}
              className={`w-44 gap-two rounded-three border p-three active:opacity-70 ${mine ? "border-brand bg-paper" : "border-line bg-paper"}`}
            >
              <View className="flex-row items-center gap-two">
                <View className={`h-8 w-8 items-center justify-center rounded-two ${mine ? "bg-brand" : "bg-surface"}`}>
                  <Ionicons name="desktop-outline" size={16} color={mine ? "#ffffff" : "#60646C"} />
                </View>
                <ThemedText type="smallBold" className="flex-1" numberOfLines={1}>
                  {r.name}
                </ThemedText>
              </View>
              <View className="flex-row items-center gap-one">
                <View className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-placeholder"}`} />
                <ThemedText type="small" themeColor="textSecondary" className="flex-1 text-xs" numberOfLines={1}>
                  {open ? `${open.opened_by_name} · ${formatTime(open.opened_at)}` : "Fechado"}
                </ThemedText>
              </View>
              {mine && (
                <ThemedText type="smallBold" className="text-xs text-brand">
                  Este aparelho
                </ThemedText>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
