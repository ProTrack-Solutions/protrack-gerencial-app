import type { PillTone } from "@/components/ui/status-pill";
import type { RefundMethod, ReturnKind, ReturnReason } from "@/interfaces/returns.interface";

export const REASONS: { value: ReturnReason; label: string }[] = [
  { value: "size", label: "Tamanho" },
  { value: "defect", label: "Defeito" },
  { value: "regret", label: "Desistência" },
  { value: "wrong_item", label: "Produto errado" },
  { value: "other", label: "Outro" },
];

export const reasonLabel = (reason: ReturnReason) => REASONS.find((r) => r.value === reason)?.label ?? reason;

export const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Crédito" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

export const methodLabel = (method: string | null | undefined) =>
  REFUND_METHODS.find((m) => m.value === method)?.label ?? "—";

export const KIND: Record<ReturnKind, { label: string; tone: PillTone; icon: "return-down-back" | "swap-horizontal" }> = {
  return: { label: "Devolução", tone: "warning", icon: "return-down-back" },
  exchange: { label: "Troca", tone: "brand", icon: "swap-horizontal" },
};

const cents = (v: number) => Math.round(v * 100);

/**
 * Valor devolvido ao devolver `qty` unidades de uma linha (mesma regra do
 * servidor): fechando a linha, devolve exatamente o que faltava.
 */
export function lineReturnAmount(netTotal: number, returnedTotal: number, quantity: number, returnedQty: number, qty: number) {
  if (qty <= 0) return 0;
  if (returnedQty + qty >= quantity) return Math.max(cents(netTotal - returnedTotal), 0) / 100;
  return cents((netTotal / quantity) * qty) / 100;
}

/**
 * Distribui o valor devolvido: cobre os itens novos da troca, depois abate as
 * parcelas em aberto e o resto vira vale-troca ou dinheiro de volta.
 */
export function allocate(returned: number, exchangeTotal: number, openDebt: number) {
  const r = cents(returned);
  const n = cents(exchangeTotal);
  const d = Math.max(cents(openDebt), 0);
  const used = Math.min(r, n);
  const leftover = r - used;
  const debt = Math.min(leftover, d);
  return {
    exchangeCredit: used / 100,
    difference: (n - used) / 100,
    debtReduction: debt / 100,
    rest: (leftover - debt) / 100,
  };
}
