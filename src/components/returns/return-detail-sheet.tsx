import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { useResource } from "@/hooks/use-resource";
import type { ReturnDetail } from "@/interfaces/returns.interface";
import { GetReturn } from "@/service/returns.service";
import { formatDateTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { sharePdf } from "@/utils/share";

import { KIND, methodLabel, reasonLabel } from "./format";

function Line({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-three py-one">
      <ThemedText type="small" themeColor="textSecondary" className="flex-1">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" className={className}>
        {value}
      </ThemedText>
    </View>
  );
}

function summaryLines(r: ReturnDetail) {
  const exchange = r.kind === "exchange";
  return [
    { label: "Valor devolvido", value: formatCurrency(r.returned_total) },
    ...(exchange ? [{ label: "Itens novos", value: formatCurrency(r.exchange_total) }] : []),
    ...(exchange && r.exchange_credit > 0 ? [{ label: "Usado na troca", value: formatCurrency(r.exchange_credit) }] : []),
    ...(r.difference_paid > 0
      ? [{ label: `Diferença paga (${methodLabel(r.difference_method)})`, value: formatCurrency(r.difference_paid), className: "text-blue-700" }]
      : []),
    ...(r.debt_reduction > 0 ? [{ label: "Abatido das parcelas", value: formatCurrency(r.debt_reduction), className: "text-amber-700" }] : []),
    ...(r.credit_amount > 0 ? [{ label: "Vale-troca gerado", value: formatCurrency(r.credit_amount), className: "text-pink-700" }] : []),
    ...(r.refund_amount > 0
      ? [{ label: `Devolvido em ${methodLabel(r.refund_method).toLowerCase()}`, value: formatCurrency(r.refund_amount), className: "text-emerald-700" }]
      : []),
  ];
}

/** Comprovante para o cliente: vai pelo WhatsApp, e-mail ou impressora. */
function shareReceipt(r: ReturnDetail) {
  const exchange = r.kind === "exchange";
  return sharePdf({
    title: `${exchange ? "Troca" : "Devolução"} nº ${r.number}`,
    subtitle: `${formatDateTime(r.created_at)} · ${r.customer_name || "Consumidor final"} · atendido por ${r.created_by_name || "—"}`,
    highlights: summaryLines(r)
      .slice(0, 3)
      .map((l) => ({ label: l.label, value: l.value })),
    sections: [
      {
        title: "Itens devolvidos",
        table: {
          columns: [{ label: "Produto" }, { label: "Qtd.", align: "right" }, { label: "Valor", align: "right" }],
          rows: r.items.map((it) => [it.product_name, it.quantity, formatCurrency(it.total)]),
        },
      },
      ...(exchange && r.new_items.length
        ? [
            {
              title: "Itens levados na troca",
              table: {
                columns: [{ label: "Produto" }, { label: "Qtd.", align: "right" as const }, { label: "Valor", align: "right" as const }],
                rows: r.new_items.map((it) => [it.product_name, it.quantity, formatCurrency(it.total)]),
              },
            },
          ]
        : []),
      { title: "Resumo", lines: summaryLines(r).map((l) => ({ label: l.label, value: l.value })) },
      { title: "Motivo", lines: [{ label: reasonLabel(r.reason), value: r.notes ?? "" }] },
    ],
  });
}

type ReturnDetailSheetProps = {
  id: string | null;
  initial?: ReturnDetail | null;
  onClose: () => void;
};

export function ReturnDetailSheet({ id, initial, onClose }: ReturnDetailSheetProps) {
  const { data: r, loading, error } = useResource(
    (signal) => (initial && initial.id === id ? Promise.resolve(initial) : GetReturn(id as string, signal)),
    [id, initial],
    { errorMessage: "Não foi possível carregar a devolução.", enabled: id !== null },
  );
  const exchange = r?.kind === "exchange";

  return (
    <FormSheet
      visible={id !== null}
      title={r ? `${exchange ? "Troca" : "Devolução"} nº ${r.number}` : "Carregando..."}
      subtitle={r ? `${formatDateTime(r.created_at)} por ${r.created_by_name || "—"}` : undefined}
      icon={r ? KIND[r.kind].icon : "return-down-back"}
      onClose={onClose}
    >
      {loading || !r ? (
        error ? (
          <ThemedText type="small" className="text-center text-danger">
            {error}
          </ThemedText>
        ) : (
          <View className="gap-three">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </View>
        )
      ) : (
        <>
          <View className="flex-row items-center gap-two">
            <ThemedText className="flex-1 text-lg font-bold" numberOfLines={1}>
              {r.customer_name || "Consumidor final"}
            </ThemedText>
            <StatusPill label={KIND[r.kind].label} tone={KIND[r.kind].tone} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Da venda de {formatDateTime(r.sale_created_at)} ({formatCurrency(r.sale_total)}) · motivo: {reasonLabel(r.reason).toLowerCase()}
          </ThemedText>

          <View className="rounded-three border border-line bg-field p-three">
            {summaryLines(r).map((l) => (
              <Line key={l.label} {...l} />
            ))}
          </View>

          <Pressable
            onPress={() => {
              haptics.tap();
              shareReceipt(r);
            }}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-two rounded-three border border-brand-line bg-brand-soft py-three active:opacity-70"
          >
            <Ionicons name="share-outline" size={18} color="#3c87f7" />
            <ThemedText type="smallBold" className="text-brand">
              Compartilhar comprovante
            </ThemedText>
          </Pressable>

          <View className="gap-two">
            <ThemedText type="smallBold">Itens devolvidos</ThemedText>
            {r.items.map((it) => (
              <View key={it.product_id} className="flex-row items-center gap-three rounded-two bg-surface p-three">
                <View className="flex-1 gap-half">
                  <ThemedText type="smallBold">{it.product_name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                    {it.quantity} × {formatCurrency(it.unit_amount)}
                    {!it.restock ? " · avariado, não voltou ao estoque" : ""}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{formatCurrency(it.total)}</ThemedText>
              </View>
            ))}
          </View>

          {exchange && r.new_items.length > 0 && (
            <View className="gap-two">
              <ThemedText type="smallBold">Levou na troca</ThemedText>
              {r.new_items.map((it) => (
                <View key={it.product_id} className="flex-row items-center gap-three rounded-two bg-brand-soft p-three">
                  <View className="flex-1 gap-half">
                    <ThemedText type="smallBold">{it.product_name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      {it.quantity} × {formatCurrency(it.unit_price)}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">{formatCurrency(it.total)}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {r.notes ? (
            <View className="gap-half">
              <ThemedText type="smallBold">Observação</ThemedText>
              <ThemedText type="small">{r.notes}</ThemedText>
            </View>
          ) : null}

          {r.out_of_window && (
            <View className="flex-row items-start gap-two rounded-two bg-amber-50 p-three">
              <Ionicons name="shield-outline" size={16} color="#B45309" />
              <ThemedText type="small" className="flex-1 text-amber-800">
                Aceita fora do prazo de troca{r.override_reason ? `: “${r.override_reason}”` : ""}.
              </ThemedText>
            </View>
          )}
        </>
      )}
    </FormSheet>
  );
}
