import type { Ionicons } from "@expo/vector-icons";

import type { ReportCell, ReportColumnType, ReportType } from "@/interfaces/reports.interface";
import { formatCurrency } from "@/utils/format";
import { formatIsoDate, toIsoDate } from "@/utils/dates";

export type ReportDefinition = {
  type: ReportType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  /** Posição de estoque é sempre "agora": o período não se aplica. */
  usesPeriod: boolean;
};

export const REPORT_GROUPS: { label: string; reports: ReportDefinition[] }[] = [
  {
    label: "Vendas",
    reports: [
      { type: "sales", title: "Vendas no período", description: "Todas as vendas com cliente, vendedor e lucro", icon: "cart-outline", color: "#3c87f7", usesPeriod: true },
      { type: "sales_by_day", title: "Faturamento por dia", description: "Vendas, ticket médio e lucro dia a dia", icon: "calendar-outline", color: "#3c87f7", usesPeriod: true },
      { type: "sales_by_payment_method", title: "Por forma de pagamento", description: "Dinheiro, Pix, cartão e a prazo", icon: "card-outline", color: "#3c87f7", usesPeriod: true },
      { type: "sales_by_seller", title: "Por vendedor", description: "Desempenho de cada vendedor, base para comissão", icon: "trophy-outline", color: "#3c87f7", usesPeriod: true },
      { type: "sales_by_customer", title: "Por cliente", description: "Clientes que mais compraram", icon: "person-outline", color: "#3c87f7", usesPeriod: true },
    ],
  },
  {
    label: "Produtos e estoque",
    reports: [
      { type: "products_abc", title: "Curva ABC e margem", description: "Produtos que mais faturam e a margem de cada um", icon: "layers-outline", color: "#7C3AED", usesPeriod: true },
      { type: "profit_category", title: "Margem por categoria", description: "Receita, custo e lucro de cada categoria", icon: "pricetags-outline", color: "#7C3AED", usesPeriod: true },
      { type: "inventory", title: "Posição de estoque", description: "Saldo atual e valor do estoque", icon: "cube-outline", color: "#7C3AED", usesPeriod: false },
      { type: "stock_movements", title: "Movimentações de estoque", description: "Entradas, saídas e ajustes (kardex)", icon: "swap-vertical-outline", color: "#7C3AED", usesPeriod: true },
    ],
  },
  {
    label: "Financeiro",
    reports: [
      { type: "dre", title: "DRE gerencial", description: "Receita, CMV, despesas e resultado", icon: "scale-outline", color: "#0E7490", usesPeriod: true },
      { type: "open_installments", title: "Inadimplência", description: "Parcelas em aberto e dias de atraso", icon: "alarm-outline", color: "#0E7490", usesPeriod: true },
      { type: "payments_received", title: "Recebimentos de crediário", description: "Pagamentos de parcelas recebidos", icon: "cash-outline", color: "#0E7490", usesPeriod: true },
      { type: "bills_payable", title: "Contas a pagar", description: "Contas do período, pagas e em aberto", icon: "receipt-outline", color: "#0E7490", usesPeriod: true },
      { type: "cash_sessions", title: "Fechamentos de caixa", description: "Turnos, sangrias, suprimentos e diferenças", icon: "wallet-outline", color: "#0E7490", usesPeriod: true },
    ],
  },
];

export const REPORTS = REPORT_GROUPS.flatMap((g) => g.reports);
export const findReport = (type: string) => REPORTS.find((r) => r.type === type) ?? REPORTS[0];

export type PeriodPreset = "today" | "yesterday" | "last_7" | "last_30" | "this_month" | "last_month" | "this_year" | "custom";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7", label: "7 dias" },
  { value: "last_30", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

/** Limite da API para o intervalo de datas. */
export const MAX_PERIOD_DAYS = 731;

export function presetRange(preset: Exclude<PeriodPreset, "custom">, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const range = (start: Date, end: Date) => ({ start: toIsoDate(start), end: toIsoDate(end) });
  switch (preset) {
    case "today":
      return range(today, today);
    case "yesterday":
      return range(new Date(y, m, d - 1), new Date(y, m, d - 1));
    case "last_7":
      return range(new Date(y, m, d - 6), today);
    case "last_30":
      return range(new Date(y, m, d - 29), today);
    case "last_month":
      return range(new Date(y, m - 1, 1), new Date(y, m, 0));
    case "this_year":
      return range(new Date(y, 0, 1), today);
    default:
      return range(new Date(y, m, 1), today);
  }
}

const trimZeros = (value: string) => value.replace(/,00$/, "");

export function formatValue(value: number, type: ReportColumnType) {
  switch (type) {
    case "money":
      return formatCurrency(value);
    case "percent":
      return `${value.toFixed(1).replace(".", ",")}%`;
    default:
      return trimZeros(value.toFixed(2).replace(".", ",")).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** Datas chegam em ISO já no fuso da empresa: usa o texto direto, sem `new Date`. */
export function formatCell(value: ReportCell, type: ReportColumnType) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    if (!ISO_DATE.test(value)) return value;
    if (type === "date") return formatIsoDate(value);
    if (type === "datetime") return `${formatIsoDate(value)} ${value.slice(11, 16)}`;
    return value;
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return formatValue(value, type);
}

export const isNumericColumn = (type: ReportColumnType) => type === "money" || type === "number" || type === "percent";

/** Nulos sempre por último. */
export function compareCells(a: ReportCell, b: ReportCell) {
  if (a === b) return 0;
  if (a === null || a === "") return 1;
  if (b === null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}
