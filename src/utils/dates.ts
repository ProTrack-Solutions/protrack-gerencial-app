const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const pad = (n: number) => String(n).padStart(2, "0");

const parse = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** ISO -> "14:05" */
export function formatTime(iso: string) {
  const date = parse(iso);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
}

/** ISO -> "27 out, 14:05" */
export function formatDateTime(iso: string) {
  const date = parse(iso);
  if (!date) return "";
  return `${pad(date.getDate())} ${MONTHS_SHORT[date.getMonth()]}, ${formatTime(iso)}`;
}

/** ISO -> "27/10/2026" */
export function formatDate(iso: string) {
  // "2026-10-27" sem horário é data local: `new Date` leria como UTC e voltaria um dia.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatIsoDate(iso);
  const date = parse(iso);
  return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : "";
}

/** "2026-10-27" -> "27/10/2026" */
export function formatIsoDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

/** Date -> "2026-10-27" no fuso do aparelho. */
export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-27" -> Date à meia-noite local. */
export function fromIsoDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Hoje deslocado em `days` dias, como "2026-10-27". */
export function isoDaysFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** "2h 15min" entre duas datas (ou até agora). */
export function formatDuration(startIso: string, endIso?: string | null) {
  const start = parse(startIso)?.getTime() ?? Date.now();
  const end = endIso ? (parse(endIso)?.getTime() ?? Date.now()) : Date.now();
  const minutes = Math.max(0, Math.floor((end - start) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}
