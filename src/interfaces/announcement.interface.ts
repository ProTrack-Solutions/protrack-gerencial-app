/** Espelha o enum announcement_type da API. */
export type AnnouncementType = "info" | "warning" | "success" | "maintenance";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  /** Só vem na listagem completa; os avisos do dia são sempre ativos. */
  is_active?: boolean;
  starts_at: string;
  /** Aviso sem data de fim chega como "0001-01-01T00:00:00Z". */
  expires_at: string;
  created_at: string;
}

/** GET /announcements (paginação pelos headers Page e PerPage). */
export interface AnnouncementPage {
  data: Announcement[] | null;
  page: number;
  per_page: number;
  total_rows: number;
  total_pages: number;
}

export interface CreateAnnouncementParams {
  title: string;
  content: string;
  type: AnnouncementType;
  starts_at: string;
  expires_at?: string;
}
