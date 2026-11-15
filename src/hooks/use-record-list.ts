import { useState } from "react";
import { Alert } from "react-native";

import { useResource } from "@/hooks/use-resource";
import { getApiErrorMessage } from "@/service/api.service";
import { haptics } from "@/utils/haptics";

/**
 * Lista de cadastro carregada de uma vez (as APIs de configuração não paginam),
 * com busca local e troca de status otimista.
 */
export function useRecordList<T extends { id: string }>(
  fetcher: (signal: AbortSignal) => Promise<T[]>,
  options: { errorMessage: string; searchText: (item: T) => string },
) {
  const resource = useResource(fetcher, [], { errorMessage: options.errorMessage });
  const [query, setQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const items = (resource.data ?? []).filter((item) => !q || options.searchText(item).toLowerCase().includes(q));

  /** Aplica a mudança na tela na hora e desfaz se a API recusar. */
  const toggle = async (item: T, patch: Partial<T>, request: () => Promise<unknown>) => {
    const previous = resource.data;
    resource.setData((current) => (current ?? []).map((it) => (it.id === item.id ? { ...it, ...patch } : it)));
    setTogglingId(item.id);
    try {
      await request();
    } catch (error) {
      haptics.error();
      resource.setData(previous);
      Alert.alert("Não foi possível alterar", getApiErrorMessage(error, "Tente novamente."));
    } finally {
      setTogglingId(null);
    }
  };

  return { ...resource, items, query, setQuery, togglingId, toggle };
}
