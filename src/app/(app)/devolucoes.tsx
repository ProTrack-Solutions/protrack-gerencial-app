import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReturnCard } from "@/components/returns/return-card";
import { ReturnDetailSheet } from "@/components/returns/return-detail-sheet";
import { SearchInput } from "@/components/sale/search-input";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { CardListSkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor } from "@/constants/theme";
import { useSideMenu } from "@/contexts/side-menu-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFocusReload } from "@/hooks/use-focus-reload";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import type { ReturnKind } from "@/interfaces/returns.interface";
import { ListReturns } from "@/service/returns.service";
import { formatNumber } from "@/utils/format";
import { haptics } from "@/utils/haptics";

const PER_PAGE = 20;

type KindFilter = ReturnKind | "all";
const KINDS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "return", label: "Devoluções" },
  { value: "exchange", label: "Trocas" },
];

export default function ReturnsScreen() {
  const insets = useSafeAreaInsets();
  const sideMenu = useSideMenu();
  const params = useLocalSearchParams<{ created?: string }>();
  const [searchText, setSearchText] = useState("");
  const search = useDebouncedValue(searchText.trim(), 400);
  const [kind, setKind] = useState<KindFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = usePaginatedList(
    async (page, signal) => {
      const response = await ListReturns(
        { page, per_page: PER_PAGE, search: search || undefined, kind: kind === "all" ? undefined : kind },
        signal,
      );
      const items = response.data ?? [];
      return { items, total: response.total, hasMore: page * PER_PAGE < (response.total ?? 0) };
    },
    [search, kind],
    "Não foi possível carregar as trocas e devoluções.",
  );
  useFocusReload(list.reload);

  // Ao voltar de uma devolução recém-registrada, abre o comprovante dela.
  useEffect(() => {
    if (!params.created) return;
    setOpenId(params.created);
    router.setParams({ created: undefined });
  }, [params.created]);

  const filtered = Boolean(search) || kind !== "all";

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Trocas e Devoluções"
        subtitle="Itens que voltaram das vendas."
        leading={{ type: "menu", onPress: sideMenu.open }}
      />

      <View className="px-three py-three border-b-hairline border-line">
        <SearchInput
          placeholder="Cliente, produto ou nº"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={list.loading ? [] : list.items}
        keyExtractor={(r) => r.id}
        contentContainerClassName="w-full max-w-content self-center gap-two p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={BrandColor} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View className="mb-one gap-three">
            <FilterChips options={KINDS} value={kind} onChange={setKind} />
            {!list.loading && !list.error && list.total !== undefined && (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {formatNumber(list.total)} {list.total === 1 ? "registro" : "registros"}
              </ThemedText>
            )}
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <CardListSkeleton values={0} />
          ) : (
            <EmptyState
              icon="return-down-back-outline"
              message={list.error ?? (filtered ? "Nada encontrado." : "Nenhuma troca ou devolução ainda.")}
              error={Boolean(list.error)}
              onRetry={list.error ? list.refresh : undefined}
            />
          )
        }
        ListFooterComponent={
          list.loadingMore ? (
            <View className="py-three">
              <ActivityIndicator color={BrandColor} />
            </View>
          ) : null
        }
        renderItem={({ item }) => <ReturnCard item={item} onPress={() => setOpenId(item.id)} />}
      />

      {/* Botão flutuante: a ação principal fica no alcance do polegar. */}
      <Pressable
        onPress={() => {
          haptics.tap();
          router.push("/nova-devolucao");
        }}
        accessibilityRole="button"
        accessibilityLabel="Nova troca ou devolução"
        className="absolute right-four flex-row items-center gap-two rounded-full bg-brand px-four py-three active:opacity-85"
        style={{
          bottom: insets.bottom + 24,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={20} color="#ffffff" />
        <ThemedText type="smallBold" className="text-white">
          Nova troca
        </ThemedText>
      </Pressable>

      <ReturnDetailSheet id={openId} onClose={() => setOpenId(null)} />
    </View>
  );
}
