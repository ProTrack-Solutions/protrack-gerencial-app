import type { PillTone } from "@/components/ui/status-pill";
import type { PurchaseBillStatus, PurchaseOrderStatus } from "@/interfaces/purchases.interface";
import { fromIsoDate, toIsoDate } from "@/utils/dates";

export const ORDER_STATUS: Record<PurchaseOrderStatus, { label: string; tone: PillTone }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  sent: { label: "Enviado", tone: "brand" },
  partial: { label: "Recebido em parte", tone: "warning" },
  received: { label: "Recebido", tone: "success" },
  closed: { label: "Encerrado", tone: "neutral" },
  canceled: { label: "Cancelado", tone: "danger" },
};

export const STATUS_FILTERS: { value: PurchaseOrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "sent", label: "Enviados" },
  { value: "partial", label: "Em parte" },
  { value: "received", label: "Recebidos" },
  { value: "closed", label: "Encerrados" },
  { value: "canceled", label: "Cancelados" },
];

export const BILL_STATUS: Record<PurchaseBillStatus, { label: string; tone: PillTone }> = {
  pending: { label: "Pendente", tone: "warning" },
  paid: { label: "Paga", tone: "success" },
  overdue: { label: "Vencida", tone: "danger" },
  scheduled: { label: "Agendada", tone: "brand" },
  canceled: { label: "Cancelada", tone: "neutral" },
  partial: { label: "Paga em parte", tone: "violet" },
};

export const round2 = (value: number) => Math.round(value * 100) / 100;
export const round4 = (value: number) => Math.round(value * 10000) / 10000;

/** Custo unitário pode ter até 4 casas (rateio de frete/desconto). */
export function unitMoney(value: number) {
  const fixed = round4(value).toFixed(4).replace(/0{1,2}$/, "");
  const [integer, decimals] = fixed.split(".");
  return `R$ ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimals}`;
}

/** Margem sobre o preço de venda. */
export const margin = (cost: number, price: number) => (price > 0 ? ((price - cost) / price) * 100 : 0);

/** Soma meses mantendo o dia (31/01 + 1 mês -> 28/02). */
export function addMonths(iso: string, months: number) {
  const base = fromIsoDate(iso);
  const day = base.getDate();
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

export function addDays(iso: string, days: number) {
  const base = fromIsoDate(iso);
  return toIsoDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

/** Parcelas iguais em centavos; o arredondamento vai na última para a soma fechar. */
export function splitInstallments(total: number, count: number, firstDue: string, intervalDays: number) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, i) => ({
    due_date: intervalDays === 30 ? addMonths(firstDue, i) : addDays(firstDue, i * intervalDays),
    amount: (i === count - 1 ? cents - base * (count - 1) : base) / 100,
  }));
}

/** Custo de cada linha com frete/despesas/desconto rateados pelo valor (mesma conta da API). */
export function allocateLanded(lines: { quantity: number; unitCost: number }[], extra: number) {
  const itemsTotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const quantity = lines.reduce((s, l) => s + l.quantity, 0);
  return lines.map((l) => {
    if (l.quantity <= 0) return l.unitCost;
    const weight = itemsTotal > 0 ? (l.quantity * l.unitCost) / itemsTotal : quantity > 0 ? l.quantity / quantity : 0;
    return round4(Math.max(l.unitCost + (extra * weight) / l.quantity, 0));
  });
}

/** Custo médio ponderado depois de receber. */
export function averageCost(stock: number, current: number, qty: number, landed: number, bulk: boolean) {
  const base = Math.max(stock, 0);
  if (bulk || base === 0 || qty <= 0) return round2(landed);
  return round2((base * current + qty * landed) / (base + qty));
}
