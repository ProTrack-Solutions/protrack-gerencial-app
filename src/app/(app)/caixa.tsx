import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CashRegisterSkeleton } from "@/components/cash-register/cash-register-skeleton";
import { OpenRegisterCard } from "@/components/cash-register/open-register-card";
import { OpenRegisterView } from "@/components/cash-register/open-register-view";
import { RegistersBar } from "@/components/cash-register/registers-bar";
import { SessionDetailSheet } from "@/components/cash-register/session-detail-sheet";
import { SessionRow } from "@/components/cash-register/session-row";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/filter-chips";
import { CardListSkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor } from "@/constants/theme";
import { useSideMenu } from "@/contexts/side-menu-context";
import { useCashRegister, useCashSessions } from "@/hooks/use-cash-register";
import type { CashSessionDetail } from "@/interfaces/cash-register.interface";

type HistoryScope = "this" | "all";

/**
 * Turno do caixa físico deste aparelho: abertura, sangria/suprimento,
 * transferência de troco e fechamento conferindo a gaveta. Embaixo, o
 * histórico de turnos. O resumo se atualiza sozinho a cada 30s.
 */
export default function CashRegisterScreen() {
  const insets = useSafeAreaInsets();
  const sideMenu = useSideMenu();
  const cash = useCashRegister();
  const [scope, setScope] = useState<HistoryScope>("this");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [report, setReport] = useState<{ id: string; initial?: CashSessionDetail } | null>(null);

  const canFilter = cash.registers.length > 1 && Boolean(cash.register);
  const filterId = canFilter && scope === "this" ? cash.register?.id : undefined;
  const history = useCashSessions(filterId, historyVersion);
  const showRegister = new Set(history.items.map((s) => s.register_id)).size > 1;

  const apply = (detail: CashSessionDetail) => {
    cash.apply(detail);
    setHistoryVersion((v) => v + 1);
  };

  const refresh = () => {
    cash.refresh();
    history.refresh();
  };

  const main = () => {
    if (cash.needsChoice) return null;
    if (cash.loading) return <CashRegisterSkeleton />;
    if (cash.error) return <EmptyState icon="wallet-outline" message={cash.error} error onRetry={refresh} />;
    if (!cash.register) {
      return <EmptyState icon="wallet-outline" message="Nenhum caixa ativo. Cadastre um caixa no ProTrack web." />;
    }
    if (cash.current) {
      return (
        <OpenRegisterView
          register={cash.register}
          registers={cash.registers}
          detail={cash.current}
          onChange={apply}
          onClosed={(closed) => {
            apply(closed);
            setReport({ id: closed.session.id, initial: closed });
          }}
        />
      );
    }
    // key: trocar de caixa limpa o valor digitado na abertura
    return <OpenRegisterCard key={cash.register.id} register={cash.register} onOpened={apply} />;
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Caixa"
        subtitle="Abertura, sangria, suprimento e fechamento."
        leading={{ type: "menu", onPress: sideMenu.open }}
      />

      <FlatList
        data={history.loading ? [] : history.items}
        keyExtractor={(s) => s.id}
        contentContainerClassName="w-full max-w-content self-center gap-two p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={cash.refreshing || history.refreshing} onRefresh={refresh} tintColor={BrandColor} />}
        onEndReached={history.loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View className="mb-one gap-three">
            <RegistersBar
              registers={cash.registers}
              selectedId={cash.register?.id}
              needsChoice={cash.needsChoice}
              onChoose={cash.choose}
            />
            {main()}
            <View className="mt-two gap-two">
              <ThemedText className="font-bold">Histórico de turnos</ThemedText>
              {canFilter && (
                <Segmented
                  options={[
                    { value: "this", label: "Este caixa" },
                    { value: "all", label: "Todos os caixas" },
                  ]}
                  value={scope}
                  onChange={setScope}
                />
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          history.loading ? (
            <CardListSkeleton count={3} />
          ) : (
            <EmptyState icon="time-outline" message={history.error ?? "Nenhum turno registrado até agora."} error={Boolean(history.error)} />
          )
        }
        ListFooterComponent={
          history.loadingMore ? (
            <View className="py-three">
              <ActivityIndicator color={BrandColor} />
            </View>
          ) : null
        }
        renderItem={({ item }) => <SessionRow session={item} showRegister={showRegister} onPress={() => setReport({ id: item.id })} />}
      />

      <SessionDetailSheet id={report?.id ?? null} initial={report?.initial} onClose={() => setReport(null)} />
    </View>
  );
}
