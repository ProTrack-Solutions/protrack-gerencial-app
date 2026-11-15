import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { STATUS_FILTERS } from "@/components/purchases/format";
import { OrderCard } from "@/components/purchases/order-card";
import { SearchInput } from "@/components/sale/search-input";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { CardListSkeleton, SummarySkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor, Gradients } from "@/constants/theme";
import { useSideMenu } from "@/contexts/side-menu-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFocusReload } from "@/hooks/use-focus-reload";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import type { PurchaseOrderStatus, PurchasesOverview } from "@/interfaces/purchases.interface";
import { ListPurchaseOrders } from "@/service/purchases.service";
import { formatCurrency, formatNumber } from "@/utils/format";
import { haptics } from "@/utils/haptics";

const PER_PAGE = 20;

type StatusFilter = PurchaseOrderStatus | "all";

function OverviewCard({ overview }: { overview: PurchasesOverview }) {
  return (
    <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="gap-three rounded-four p-four">
      <View className="flex-row items-start justify-between">
        <View className="gap-half">
          <ThemedText type="small" className="text-white/85">
            A receber dos fornecedores
          </ThemedText>
          <ThemedText className="text-[28px] font-bold leading-9 text-white" numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(overview.pending_total ?? 0)}
          </ThemedText>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-two bg-white/20">
          <Ionicons name="cube-outline" size={20} color="#ffffff" />
        </View>
      </View>
      <View className="flex-row gap-two">
        <View className="flex-1 gap-half rounded-three bg-white/15 p-three">
          <ThemedText type="small" className="text-xs text-white/85">
            Recebido no mês
          </ThemedText>
          <ThemedText className="font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(overview.received_this_month ?? 0)}
          </ThemedText>
        </View>
        <View className="flex-1 gap-half rounded-three bg-white/15 p-three">
          <View className="flex-row items-center gap-one">
            {overview.late_orders > 0 && <View className="h-2 w-2 rounded-full bg-rose-300" />}
            <ThemedText type="small" className="text-xs text-white/85">
              Pedidos atrasados
            </ThemedText>
          </View>
          <ThemedText className="font-bold text-white">{formatNumber(overview.late_orders ?? 0)}</ThemedText>
        </View>
      </View>
    </LinearGradient>
  );
}

export default function PurchasesScreen() {
  const insets = useSafeAreaInsets();
  const sideMenu = useSideMenu();
  const [searchText, setSearchText] = useState("");
  const search = useDebouncedValue(searchText.trim(), 400);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [overview, setOverview] = useState<PurchasesOverview | null>(null);

  const list = usePaginatedList(
    async (page, signal) => {
      const response = await ListPurchaseOrders(
        { page, per_page: PER_PAGE, search: search || undefined, status: status === "all" ? undefined : status },
        signal,
      );
      if (page === 1 && response.overview) setOverview(response.overview);
      return { items: response.data ?? [], total: response.total_rows, hasMore: page < (response.total_pages || 1) };
    },
    [search, status],
    "Não foi possível carregar os pedidos de compra.",
  );
  useFocusReload(list.reload);

  const counts = overview?.count_by_status ?? {};
  const options = STATUS_FILTERS.map((o) => ({ ...o, count: o.value === "all" ? undefined : counts[o.value] }));

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Compras" subtitle="Pedidos aos fornecedores e recebimento." leading={{ type: "menu", onPress: sideMenu.open }} />

      <View className="px-three py-three border-b-hairline border-line">
        <SearchInput placeholder="Fornecedor, produto ou nº" value={searchText} onChangeText={setSearchText} returnKeyType="search" />
      </View>

      <FlatList
        data={list.loading ? [] : list.items}
        keyExtractor={(o) => o.id}
        contentContainerClassName="w-full max-w-content self-center gap-two p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={BrandColor} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View className="mb-one gap-three">
            {overview ? <OverviewCard overview={overview} /> : list.loading ? <SummarySkeleton /> : null}
            <FilterChips options={options} value={status} onChange={setStatus} />
            {!list.loading && !list.error && list.total !== undefined && (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {formatNumber(list.total)} {list.total === 1 ? "pedido" : "pedidos"}
              </ThemedText>
            )}
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <CardListSkeleton />
          ) : (
            <EmptyState
              icon="cube-outline"
              message={list.error ?? (search || status !== "all" ? "Nenhum pedido encontrado." : "Nenhum pedido de compra ainda.")}
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
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => router.push({ pathname: "/pedido-compra", params: { id: item.id } })} />
        )}
      />

      <Pressable
        onPress={() => {
          haptics.tap();
          router.push("/novo-pedido-compra");
        }}
        accessibilityRole="button"
        accessibilityLabel="Novo pedido de compra"
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
          Novo pedido
        </ThemedText>
      </Pressable>
    </View>
  );
}
