import { isCancel } from "axios";
import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

import { getApiErrorMessage } from "@/service/api.service";

/**
 * Carrega um recurso da API ao montar (e quando `deps` muda), com recarga por
 * pull-to-refresh. `setData` permite gravar a resposta de uma ação (ex: abrir
 * o caixa devolve o turno já atualizado) sem buscar de novo.
 */
export function useResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: { errorMessage: string; enabled?: boolean },
) {
  const { errorMessage, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(fetcher, deps);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        setData(await fetchData(controller.signal));
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
    [fetchData, errorMessage],
  );

  useEffect(() => {
    if (!enabled) return;
    load("initial");
    return () => controllerRef.current?.abort();
  }, [load, enabled]);

  const refresh = useCallback(() => load("refresh"), [load]);
  /** Recarrega sem mostrar o indicador (ex: ao voltar para a tela). */
  const reload = useCallback(() => load("silent"), [load]);

  return { data, setData, loading, refreshing, error, refresh, reload };
}
