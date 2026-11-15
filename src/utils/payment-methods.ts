import { PAYMENT_METHODS } from "@/components/sale/payment-method-grid";

// Formas que aparecem em resumos/relatórios mas não são escolhidas na venda.
const EXTRA: Record<string, { label: string; color: string }> = {
  store_credit: { label: "Vale-troca", color: "#DB2777" },
};

/** Nome da forma de pagamento vinda da API ("credit_card" -> "Cartão de Crédito"). */
export function paymentMethodName(value: string) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? EXTRA[value]?.label ?? "Outro";
}

/** Cor usada nos gráficos e marcadores da forma de pagamento. */
export function paymentMethodColor(value: string) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.color ?? EXTRA[value]?.color ?? "#94A3B8";
}
