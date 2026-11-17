import { isCancel } from "axios";
import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

import { getApiErrorMessage } from "@/service/api.service";

export type Page<T> = {
  items: T[];
  /** Há próxima página. */
  hasMore: boolean;
  /** Total de registros, quando a API informa. */
  total?: number;
};

/**
 * Lista paginada com rolagem infinita e pull-to-refresh. Cada mudança em `deps`
 * (busca, filtro) recomeça da página 1 e descarta respostas antigas.
 */
export function usePaginatedList<T extends { id: string }>(
  fetchPage: (page: number, signal?: AbortSignal) => Promise<Page<T>>,
  deps: DependencyList,
  errorMessage: string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(fetchPage, deps);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      generationRef.current += 1;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const result = await fetcher(1, controller.signal);
        setItems(result.items);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(1);
        setError(null);
      } catch (e) {
        if (isCancel(e)) return;
        setError(getApiErrorMessage(e, errorMessage));
      } finally {
        if (controllerRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetcher, errorMessage],
  );

  useEffect(() => {
    load("initial");
    return () => controllerRef.current?.abort();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    setLoadingMore(true);
    const generation = generationRef.current;
    try {
      const result = await fetcher(page + 1);
      if (generation !== generationRef.current) return;
      setItems((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !ids.has(item.id))];
      });
      setPage(page + 1);
      setHasMore(result.hasMore);
    } catch {
      // Mantém o que já carregou; o usuário pode puxar para atualizar.
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, hasMore, page, fetcher]);

  const refresh = useCallback(() => load("refresh"), [load]);
  const reload = useCallback(() => load("silent"), [load]);

  return { items, setItems, total, hasMore, loading, loadingMore, refreshing, error, refresh, reload, loadMore };
}
