import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarcodeScanner } from "@/components/product/barcode-scanner";
import { ReturnForm } from "@/components/returns/return-form";
import { SearchInput } from "@/components/sale/search-input";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { CardListSkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor } from "@/constants/theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import type { ReturnableSale, SaleSearchItem } from "@/interfaces/returns.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { GetReturnableSale, SearchSalesForReturn } from "@/service/returns.service";
import { SearchProducts } from "@/service/sale.service";
import { formatDateTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { paymentMethodName } from "@/utils/payment-methods";

const PER_PAGE = 15;

function SaleRow({ sale, loading, onPress }: { sale: SaleSearchItem; loading: boolean; onPress: () => void }) {
  const fullyReturned = sale.returned_count >= sale.items_count && sale.items_count > 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      className="gap-two rounded-three border border-line bg-paper p-three active:bg-surface"
    >
      <View className="flex-row items-start gap-two">
        <View className="flex-1 gap-half">
          <ThemedText className="font-bold" numberOfLines={1}>
            {sale.customer_name || "Consumidor final"}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            {formatDateTime(sale.created_at)} · {paymentMethodName(sale.payment_method)} · #{sale.id.slice(0, 8)}
          </ThemedText>
        </View>
        <ThemedText className="font-bold">{formatCurrency(sale.total_amount)}</ThemedText>
        {loading ? <ActivityIndicator size="small" /> : <Ionicons name="chevron-forward" size={18} color="#8A94A6" />}
      </View>
      <ThemedText type="small" className="text-xs" numberOfLines={2}>
        {sale.products}
      </ThemedText>
      {sale.returned_count > 0 && (
        <ThemedText type="smallBold" className={`text-xs ${fullyReturned ? "text-muted" : "text-amber-700"}`}>
          {fullyReturned ? "Todos os itens já devolvidos" : `${sale.returned_count} de ${sale.items_count} itens já devolvidos`}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Passo 1: achar a venda. Passo 2: escolher itens, motivo e destino do valor. */
export default function NewReturnScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState("");
  const search = useDebouncedValue(searchText.trim(), 400);
  const [sale, setSale] = useState<ReturnableSale | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const list = usePaginatedList(
    async (page, signal) => {
      const response = await SearchSalesForReturn({ search: search || undefined, page, per_page: PER_PAGE }, signal);
      const items = response.data ?? [];
      return { items, total: response.total, hasMore: page * PER_PAGE < (response.total ?? 0) };
    },
    [search],
    "Não foi possível buscar as vendas.",
  );

  const leaveForm = () => {
    haptics.warning();
    Alert.alert("Trocar de venda?", "Os itens escolhidos serão descartados.", [
      { text: "Continuar aqui", style: "cancel" },
      { text: "Trocar", style: "destructive", onPress: () => setSale(null) },
    ]);
  };

  // No Android, o botão voltar do sistema sai do formulário para a busca.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!sale) return false;
        leaveForm();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sale]),
  );

  const pickSale = async (id: string) => {
    haptics.tap();
    setLoadingId(id);
    try {
      setSale(await GetReturnableSale(id));
    } catch (error) {
      haptics.error();
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível abrir a venda."));
    } finally {
      setLoadingId(null);
    }
  };

  // A busca de vendas procura pelo nome do produto: lê a etiqueta e busca pelo nome.
  const onScanned = async (code: string) => {
    setScannerOpen(false);
    try {
      const results = await SearchProducts(code);
      const product = results.find((p) => p.barcode === code) ?? (results.length === 1 ? results[0] : undefined);
      if (!product) {
        haptics.warning();
        Alert.alert("Produto não encontrado", `Nenhum produto com o código ${code}.`);
        return;
      }
      haptics.success();
      setSearchText(product.name);
    } catch (error) {
      haptics.error();
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível buscar o produto."));
    }
  };

  if (sale) {
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader title="Nova troca/devolução" subtitle="Escolha os itens que estão voltando." leading={{ type: "back", onPress: leaveForm }} />
        <ReturnForm
          sale={sale}
          onCancel={leaveForm}
          onCreated={(created) => router.dismissTo({ pathname: "/devolucoes", params: { created: created.id } })}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Nova troca/devolução" subtitle="De qual venda são os itens?" leading={{ type: "back", onPress: router.back }} />

      <View className="flex-row items-center gap-two border-b-hairline border-line px-three py-three">
        <View className="flex-1">
          <SearchInput placeholder="Cliente, produto ou nº da venda" value={searchText} onChangeText={setSearchText} autoFocus returnKeyType="search" />
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            setScannerOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Ler código de barras do produto"
          className="h-11 w-11 items-center justify-center rounded-two bg-brand active:opacity-80"
        >
          <Ionicons name="barcode-outline" size={22} color="#ffffff" />
        </Pressable>
      </View>

      <FlatList
        data={list.loading ? [] : list.items}
        keyExtractor={(s) => s.id}
        contentContainerClassName="w-full max-w-content self-center gap-two p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={BrandColor} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <ThemedText type="small" themeColor="textSecondary" className="mb-one text-xs">
            {search ? "Resultados da busca" : "Vendas mais recentes"} · leia a etiqueta para buscar pelo produto.
          </ThemedText>
        }
        ListEmptyComponent={
          list.loading ? (
            <CardListSkeleton values={0} />
          ) : (
            <EmptyState
              icon="receipt-outline"
              message={list.error ?? "Nenhuma venda encontrada."}
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
        renderItem={({ item }) => <SaleRow sale={item} loading={loadingId === item.id} onPress={() => pickSale(item.id)} />}
      />

      <BarcodeScanner visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={onScanned} />
    </View>
  );
}
