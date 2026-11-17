import type { Ionicons } from "@expo/vector-icons";

import type { PillTone } from "@/components/ui/status-pill";
import type { Announcement, AnnouncementType } from "@/interfaces/announcement.interface";

type TypeStyle = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  /** Avisos que pedem atenção imediata. */
  urgent: boolean;
};

/** Mesma ordem de importância usada pela API em /announcements/today. */
export const ANNOUNCEMENT_TYPES: Record<AnnouncementType, TypeStyle> = {
  maintenance: { label: "Manutenção", icon: "construct-outline", color: "#EA580C", urgent: true },
  warning: { label: "Atenção", icon: "warning-outline", color: "#DC2626", urgent: true },
  info: { label: "Informativo", icon: "information-circle-outline", color: "#2563EB", urgent: false },
  success: { label: "Novidade", icon: "checkmark-circle-outline", color: "#059669", urgent: false },
};

export const getAnnouncementType = (type: string) =>
  ANNOUNCEMENT_TYPES[type as AnnouncementType] ?? ANNOUNCEMENT_TYPES.info;

/** Datas nulas chegam da API como o "zero" do Go (ano 0001). */
export function parseAnnouncementDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1971) return null;
  return date;
}

export type AnnouncementStatus = "active" | "scheduled" | "expired";

export function getAnnouncementStatus(a: Announcement, now = Date.now()): AnnouncementStatus {
  const expires = parseAnnouncementDate(a.expires_at);
  if (a.is_active === false || (expires && expires.getTime() <= now)) return "expired";
  const starts = parseAnnouncementDate(a.starts_at);
  if (starts && starts.getTime() > now) return "scheduled";
  return "active";
}

export const ANNOUNCEMENT_STATUS: Record<AnnouncementStatus, { label: string; tone: PillTone }> = {
  active: { label: "No ar", tone: "success" },
  scheduled: { label: "Agendado", tone: "brand" },
  expired: { label: "Encerrado", tone: "neutral" },
};

const DAY = 24 * 60 * 60 * 1000;

/** "Expira hoje", "Expira em 3 dias", "Começa em breve"... */
export function getAnnouncementTimeHint(a: Announcement, now = Date.now()) {
  const status = getAnnouncementStatus(a, now);
  if (status === "scheduled") {
    const starts = parseAnnouncementDate(a.starts_at)!;
    const days = Math.ceil((starts.getTime() - now) / DAY);
    return days <= 1 ? "Começa em breve" : `Começa em ${days} dias`;
  }
  if (status === "expired") return null;
  const expires = parseAnnouncementDate(a.expires_at);
  if (!expires) return "Sem data de fim";
  const days = Math.ceil((expires.getTime() - now) / DAY);
  if (days <= 0) return "Expira hoje";
  if (days === 1) return "Expira amanhã";
  return `Expira em ${days} dias`;
}

/** "há 2 dias", "ontem", "agora". */
export function timeAgo(value: string, now = Date.now()) {
  const date = parseAnnouncementDate(value);
  if (!date) return "";
  const minutes = Math.round((now - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.round(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}
