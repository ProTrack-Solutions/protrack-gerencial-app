import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { usePaginatedList } from "@/hooks/use-paginated-list";
import { useResource } from "@/hooks/use-resource";
import type { CashSessionDetail } from "@/interfaces/cash-register.interface";
import { GetCurrentCashSession, ListCashRegisters, ListCashSessions } from "@/service/cash-register.service";
import {
  getDeviceCashRegisterId,
  setDeviceCashRegisterId,
  subscribeDeviceCashRegister,
} from "@/utils/cash-register-device";

/** Vendas feitas em outro aparelho entram no resumo sem precisar recarregar. */
const POLL_INTERVAL = 30_000;

/**
 * Caixas da empresa, o caixa deste aparelho e o turno aberto nele.
 * Com um único caixa ativo ele é escolhido sozinho; com mais de um, a tela
 * pergunta em qual o aparelho trabalha (`needsChoice`).
 */
export function useCashRegister() {
  const storedId = useSyncExternalStore(subscribeDeviceCashRegister, getDeviceCashRegisterId, () => null);

  const registersQuery = useResource((signal) => ListCashRegisters(signal), [], {
    errorMessage: "Não foi possível carregar os caixas.",
  });
  const active = (registersQuery.data ?? []).filter((r) => r.active);
  const register = active.find((r) => r.id === storedId) ?? (active.length === 1 ? active[0] : undefined);
  const needsChoice = registersQuery.data !== null && !register && active.length > 1;

  // Guarda o caixa único (para continuar nele se outro for cadastrado depois)
  // e esquece o escolhido se ele foi desativado.
  useEffect(() => {
    if (registersQuery.data === null) return;
    if (register && register.id !== storedId) setDeviceCashRegisterId(register.id);
    else if (!register && storedId && !needsChoice) setDeviceCashRegisterId(null);
  }, [registersQuery.data, register, storedId, needsChoice]);

  const registerId = register?.id;
  const currentQuery = useResource(
    async (signal) => {
      const data = await GetCurrentCashSession(signal);
      return data.session ? (data as CashSessionDetail) : null;
    },
    [registerId],
    { errorMessage: "Não foi possível carregar o caixa.", enabled: Boolean(registerId) },
  );

  const reloadRegisters = registersQuery.reload;
  const reloadCurrent = currentQuery.reload;
  const reloadAll = useCallback(() => {
    reloadRegisters();
    if (registerId) reloadCurrent();
  }, [reloadRegisters, reloadCurrent, registerId]);

  // Atualiza a cada 30s enquanto a tela está aberta e o app em primeiro plano,
  // e logo que o app volta do segundo plano.
  const reloadRef = useRef(reloadAll);
  reloadRef.current = reloadAll;
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = setInterval(() => reloadRef.current(), POLL_INTERVAL);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          reloadRef.current();
          if (!timer) timer = setInterval(() => reloadRef.current(), POLL_INTERVAL);
        } else if (timer) {
          clearInterval(timer);
          timer = null;
        }
      });
      return () => {
        if (timer) clearInterval(timer);
        sub.remove();
      };
    }, []),
  );

  const setCurrent = currentQuery.setData;
  /** Abrir, movimentar e fechar devolvem o turno já atualizado. */
  const apply = useCallback(
    (detail: CashSessionDetail) => {
      setCurrent(detail.session.status === "open" ? detail : null);
      reloadRegisters();
    },
    [setCurrent, reloadRegisters],
  );

  return {
    registers: active,
    register,
    needsChoice,
    choose: setDeviceCashRegisterId,
    current: currentQuery.data,
    loading: registersQuery.loading || currentQuery.loading,
    refreshing: registersQuery.refreshing || currentQuery.refreshing,
    error: registersQuery.error ?? currentQuery.error,
    refresh: () => {
      registersQuery.refresh();
      if (registerId) currentQuery.refresh();
    },
    reload: reloadAll,
    apply,
  };
}

/** Histórico de turnos; com `registerId`, só os daquele caixa. */
export function useCashSessions(registerId: string | undefined, version: number) {
  return usePaginatedList(
    async (page, signal) => {
      const response = await ListCashSessions(page, 15, registerId, signal);
      const items = response.data ?? [];
      return {
        items,
        total: response.total_rows,
        hasMore: page < (response.total_pages || 1),
      };
    },
    [registerId, version],
    "Não foi possível carregar o histórico de turnos.",
  );
}
