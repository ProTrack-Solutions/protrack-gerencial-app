import type { Page } from "@/hooks/use-paginated-list";
import type {
  Announcement,
  AnnouncementPage,
  CreateAnnouncementParams,
} from "@/interfaces/announcement.interface";
import { apiClient } from "./api.service";

/** Avisos no ar agora, do mais importante ao menos importante (a API limita a quantidade). */
export const ListTodayAnnouncements = async (signal?: AbortSignal): Promise<Announcement[]> => {
  const response = await apiClient.get<Announcement[] | null>("/announcements/today", { signal });
  return response.data ?? [];
};

/** Quadro de avisos: todos os avisos da empresa, inclusive agendados e encerrados. */
export const ListAnnouncements = async (
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<Page<Announcement>> => {
  // A paginação vai no HEADER, não na query string.
  const response = await apiClient.get<AnnouncementPage>("/announcements", {
    headers: { Page: page, PerPage: perPage },
    signal,
  });
  const { data, total_rows, total_pages } = response.data;
  return { items: data ?? [], hasMore: page < (total_pages ?? 0), total: total_rows ?? 0 };
};

export const CreateAnnouncement = async (params: CreateAnnouncementParams): Promise<void> => {
  await apiClient.post("/announcements", params);
};

export const DeleteAnnouncement = async (id: string): Promise<void> => {
  await apiClient.delete(`/announcements/${id}`);
};
