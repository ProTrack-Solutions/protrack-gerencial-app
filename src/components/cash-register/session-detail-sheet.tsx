import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/hooks/use-resource";
import type { CashSessionDetail } from "@/interfaces/cash-register.interface";
import { GetCashSession } from "@/service/cash-register.service";
import { formatDateTime, formatDuration, formatTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { paymentMethodName } from "@/utils/payment-methods";
import { sharePdf } from "@/utils/share";

import { CashComposition, DifferenceBadge, MethodBreakdown, MovementsList, OperatorBreakdown } from "./summary-parts";

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View className="gap-three">
      <View className="flex-row items-center gap-two">
        <Ionicons name={icon} size={16} color="#4896EA" />
        <ThemedText type="smallBold">{title}</ThemedText>
      </View>
      {children}
    </View>
  );
}

/** Relatório de fechamento em PDF, para mandar ao dono pelo WhatsApp ou e-mail. */
function shareSession({ session, summary, movements }: CashSessionDetail) {
  const closed = session.status === "closed";
  const difference = session.difference ?? 0;
  return sharePdf({
    title: `${closed ? "Fechamento" : "Caixa aberto"}${session.register_name ? ` · ${session.register_name}` : ""}`,
    subtitle: `${formatDateTime(session.opened_at)}${session.closed_at ? ` até ${formatTime(session.closed_at)}` : ""} · ${formatDuration(
      session.opened_at,
      session.closed_at,
    )} · aberto por ${session.user_name ?? "—"}${session.closed_by_name ? `, fechado por ${session.closed_by_name}` : ""}`,
    highlights: closed
      ? [
          { label: "Esperado", value: formatCurrency(session.expected_cash ?? 0) },
          { label: "Contado", value: formatCurrency(session.counted_cash ?? 0) },
          {
            label: "Conferência",
            value: Math.abs(difference) < 0.005 ? "Confere" : `${difference > 0 ? "Sobra" : "Falta"} ${formatCurrency(Math.abs(difference))}`,
          },
        ]
      : [{ label: "Esperado na gaveta", value: formatCurrency(summary.expected_cash) }],
    sections: [
      {
        title: "Dinheiro na gaveta",
        lines: [
          { label: "Abertura (troco)", value: formatCurrency(session.opening_amount) },
          { label: "Recebido em dinheiro", value: formatCurrency(summary.cash_received) },
          { label: "Suprimentos", value: formatCurrency(summary.supplies_total) },
          { label: "Sangrias", value: formatCurrency(summary.withdrawals_total) },
          ...(summary.cash_refunds ? [{ label: "Devoluções", value: formatCurrency(summary.cash_refunds) }] : []),
          { label: "Esperado", value: formatCurrency(summary.expected_cash) },
        ],
      },
      {
        title: "Por forma de pagamento",
        table: {
          columns: [{ label: "Forma" }, { label: "Vendas", align: "right" }, { label: "Parcelas", align: "right" }, { label: "Recebido", align: "right" }],
          rows: (summary.by_method ?? []).map((m) => [
            paymentMethodName(m.payment_method),
            m.sales_count,
            m.receipts_count,
            formatCurrency(m.received),
          ]),
        },
      },
      {
        title: "Vendas por operador",
        table: {
          columns: [{ label: "Operador" }, { label: "Vendas", align: "right" }, { label: "Total", align: "right" }],
          rows: (summary.by_operator ?? []).map((o) => [o.user_name, o.sales_count, formatCurrency(o.sales_total + o.receipts_total)]),
        },
      },
      ...(movements?.length
        ? [
            {
              title: "Movimentações",
              table: {
                columns: [{ label: "Hora" }, { label: "Tipo" }, { label: "Motivo" }, { label: "Valor", align: "right" as const }],
                rows: movements.map((m) => [
                  formatTime(m.created_at),
                  m.transfer_label || (m.type === "supply" ? "Suprimento" : "Sangria"),
                  m.reason ?? "",
                  `${m.type === "supply" ? "+" : "−"} ${formatCurrency(m.amount)}`,
                ]),
              },
            },
          ]
        : []),
    ],
  });
}

type SessionDetailSheetProps = {
  id: string | null;
  /** Já veio pronto (ex: resposta do fechamento), sem precisar buscar. */
  initial?: CashSessionDetail | null;
  onClose: () => void;
};

/** Relatório de um turno: aberto agora ou já fechado. */
export function SessionDetailSheet({ id, initial, onClose }: SessionDetailSheetProps) {
  const { data, loading, error } = useResource(
    (signal) => (initial && initial.session.id === id ? Promise.resolve(initial) : GetCashSession(id as string, signal)),
    [id, initial],
    { errorMessage: "Não foi possível carregar o relatório.", enabled: id !== null },
  );
  const session = data?.session;
  const closed = session?.status === "closed";

  return (
    <FormSheet
      visible={id !== null}
      title={`${closed ? "Fechamento de caixa" : "Turno do caixa"}${session?.register_name ? ` · ${session.register_name}` : ""}`}
      subtitle={
        session
          ? `${formatDateTime(session.opened_at)}${session.closed_at ? ` até ${formatTime(session.closed_at)}` : ""} · ${formatDuration(
              session.opened_at,
              session.closed_at,
            )}`
          : "Carregando..."
      }
      icon="document-text-outline"
      onClose={onClose}
    >
      {loading || !data || !session ? (
        error ? (
          <ThemedText type="small" className="text-center text-danger">
            {error}
          </ThemedText>
        ) : (
          <View className="gap-three">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </View>
        )
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Aberto por {session.user_name}
            {session.closed_by_name ? ` · fechado por ${session.closed_by_name}` : ""}
          </ThemedText>

          {closed && (
            <View className="flex-row gap-two">
              {[
                { label: "ESPERADO", value: formatCurrency(session.expected_cash ?? 0) },
                { label: "CONTADO", value: formatCurrency(session.counted_cash ?? 0) },
              ].map((tile) => (
                <View key={tile.label} className="flex-1 gap-half rounded-three border border-line bg-field p-three">
                  <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
                    {tile.label}
                  </ThemedText>
                  <ThemedText className="font-bold" numberOfLines={1} adjustsFontSizeToFit>
                    {tile.value}
                  </ThemedText>
                </View>
              ))}
              <View className="flex-1 justify-between gap-half rounded-three border border-line bg-field p-three">
                <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
                  CONFERÊNCIA
                </ThemedText>
                <View className="items-start">
                  <DifferenceBadge value={session.difference ?? 0} />
                </View>
              </View>
            </View>
          )}

          <Pressable
            onPress={() => {
              haptics.tap();
              shareSession(data);
            }}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-two rounded-three border border-brand-line bg-brand-soft py-three active:opacity-70"
          >
            <Ionicons name="share-outline" size={18} color="#4896EA" />
            <ThemedText type="smallBold" className="text-brand">
              Compartilhar relatório em PDF
            </ThemedText>
          </Pressable>

          <Section title="Dinheiro na gaveta" icon="cash-outline">
            <CashComposition openingAmount={session.opening_amount} summary={data.summary} />
          </Section>
          <Section title="Por forma de pagamento" icon="card-outline">
            <MethodBreakdown summary={data.summary} />
          </Section>
          <Section title="Vendas por operador" icon="people-outline">
            <OperatorBreakdown summary={data.summary} />
          </Section>
          <Section title="Movimentações" icon="list-outline">
            <MovementsList movements={data.movements ?? []} />
          </Section>

          {(session.opening_notes || session.closing_notes) && (
            <Section title="Observações" icon="chatbubble-outline">
              {session.opening_notes ? (
                <View className="gap-half">
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                    Abertura
                  </ThemedText>
                  <ThemedText type="small">{session.opening_notes}</ThemedText>
                </View>
              ) : null}
              {session.closing_notes ? (
                <View className="gap-half">
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                    Fechamento
                  </ThemedText>
                  <ThemedText type="small">{session.closing_notes}</ThemedText>
                </View>
              ) : null}
            </Section>
          )}
        </>
      )}
    </FormSheet>
  );
}
