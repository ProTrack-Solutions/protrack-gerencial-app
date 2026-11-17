import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { StatusPill } from "@/components/ui/status-pill";
import type { CashMovement, CashSummary } from "@/interfaces/cash-register.interface";
import { formatTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { paymentMethodColor, paymentMethodName } from "@/utils/payment-methods";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resultado da conferência: sobra, falta ou confere. */
export function DifferenceBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return <StatusPill label="Confere" tone="success" />;
  return <StatusPill label={`${value > 0 ? "Sobra" : "Falta"} ${formatCurrency(Math.abs(value))}`} tone={value > 0 ? "warning" : "danger"} />;
}

export function SummaryEmpty({ text }: { text: string }) {
  return (
    <View className="items-center gap-two py-four">
      <Ionicons name="file-tray-outline" size={24} color="#8A94A6" />
      <ThemedText type="small" themeColor="textSecondary" className="text-center">
        {text}
      </ThemedText>
    </View>
  );
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View className="h-2 overflow-hidden rounded-full bg-surface">
      <View className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, backgroundColor: color }} />
    </View>
  );
}

/** Quanto entrou em cada forma de pagamento, com barra proporcional. */
export function MethodBreakdown({ summary }: { summary: CashSummary }) {
  const methods = (summary.by_method ?? []).filter(
    (m) => m.received !== 0 || m.sales_count > 0 || (m.refunds_count ?? 0) > 0,
  );
  if (methods.length === 0) return <SummaryEmpty text="Nenhuma venda ou recebimento neste caixa ainda." />;
  const max = Math.max(...methods.map((m) => m.received), 1);

  return (
    <View className="gap-three">
      {methods.map((m) => {
        const color = paymentMethodColor(m.payment_method);
        const details = [
          m.sales_count ? plural(m.sales_count, "venda", "vendas") : null,
          m.receipts_count ? plural(m.receipts_count, "parcela recebida", "parcelas recebidas") : null,
          m.refunds_total ? `${formatCurrency(m.refunds_total)} devolvidos` : null,
          m.payment_method === "installments" ? `${formatCurrency(m.sales_total)} vendidos, só a entrada entra` : null,
          m.payment_method === "store_credit" ? "pago com vale-troca" : null,
        ].filter(Boolean);
        return (
          <View key={m.payment_method} className="gap-one">
            <View className="flex-row items-center justify-between gap-two">
              <View className="flex-1 flex-row items-center gap-two">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <ThemedText type="smallBold" numberOfLines={1}>
                  {paymentMethodName(m.payment_method)}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{formatCurrency(m.received)}</ThemedText>
            </View>
            <Bar ratio={m.received / max} color={color} />
            {details.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                {details.join(" · ")}
              </ThemedText>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Conta do dinheiro que deveria estar na gaveta. */
export function CashComposition({ openingAmount, summary }: { openingAmount: number; summary: CashSummary }) {
  const rows = [
    { label: "Abertura (troco)", value: openingAmount, sign: "" },
    { label: "Recebido em dinheiro", value: summary.cash_received, sign: "+" },
    { label: "Suprimentos e troco recebido", value: summary.supplies_total, sign: "+" },
    { label: "Sangrias e troco enviado", value: summary.withdrawals_total, sign: "−" },
    ...(summary.cash_refunds ? [{ label: "Devoluções a clientes", value: summary.cash_refunds, sign: "−" }] : []),
  ];

  return (
    <View className="gap-two">
      {rows.map((r) => (
        <View key={r.label} className="flex-row items-center justify-between gap-three">
          <ThemedText type="small" themeColor="textSecondary" className="flex-1">
            {r.label}
          </ThemedText>
          <ThemedText type="small" className={r.sign === "−" && r.value > 0 ? "text-danger" : r.sign === "+" && r.value > 0 ? "text-success" : "text-ink"}>
            {r.sign && r.value > 0 ? `${r.sign} ` : ""}
            {formatCurrency(r.value)}
          </ThemedText>
        </View>
      ))}
      {summary.change_count > 0 && (
        <ThemedText type="small" themeColor="textSecondary" className="text-xs">
          Já descontado {formatCurrency(summary.change_total)} de troco em {plural(summary.change_count, "venda", "vendas")}.
        </ThemedText>
      )}
      <View className="mt-one flex-row items-center justify-between border-t-hairline border-line pt-two">
        <ThemedText type="smallBold">Esperado na gaveta</ThemedText>
        <ThemedText className="font-bold">{formatCurrency(summary.expected_cash)}</ThemedText>
      </View>
    </View>
  );
}

export function MovementsList({ movements }: { movements: CashMovement[] }) {
  if (!movements?.length) return <SummaryEmpty text="Nenhuma sangria, suprimento ou transferência registrada." />;

  return (
    <View>
      {movements.map((m, index) => {
        const supply = m.type === "supply";
        const icon = m.transfer_label ? "swap-horizontal" : supply ? "arrow-up-circle" : "arrow-down-circle";
        const color = supply ? "#2F855A" : "#DC2626";
        return (
          <View
            key={m.id}
            className={`flex-row items-center gap-three py-two ${index > 0 ? "border-t-hairline border-line" : ""}`}
          >
            <Ionicons name={icon} size={22} color={color} />
            <View className="flex-1">
              <ThemedText type="smallBold">{m.transfer_label || (supply ? "Suprimento" : "Sangria")}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={2}>
                {formatTime(m.created_at)}
                {m.created_by_name ? ` · por ${m.created_by_name}` : ""}
                {m.reason ? ` · ${m.reason}` : ""}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color }}>
              {supply ? "+" : "−"} {formatCurrency(m.amount)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/** Quanto cada operador vendeu e recebeu no turno. */
export function OperatorBreakdown({ summary }: { summary: CashSummary }) {
  const operators = summary.by_operator ?? [];
  if (operators.length === 0) return <SummaryEmpty text="Nenhuma venda neste caixa ainda." />;
  const max = Math.max(...operators.map((o) => o.sales_total + o.receipts_total), 1);

  return (
    <View className="gap-three">
      {operators.map((o) => {
        const total = o.sales_total + o.receipts_total;
        return (
          <View key={o.user_id} className="gap-one">
            <View className="flex-row items-center justify-between gap-two">
              <ThemedText type="smallBold" className="flex-1" numberOfLines={1}>
                {o.user_name}
              </ThemedText>
              <ThemedText type="smallBold">{formatCurrency(total)}</ThemedText>
            </View>
            <Bar ratio={total / max} color="#4896EA" />
            <ThemedText type="small" themeColor="textSecondary" className="text-xs">
              {plural(o.sales_count, "venda", "vendas")} · {formatCurrency(o.sales_total)}
              {o.receipts_total > 0 ? ` · ${formatCurrency(o.receipts_total)} em parcelas` : ""}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}
