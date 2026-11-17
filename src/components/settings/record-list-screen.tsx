import type { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchInput } from "@/components/sale/search-input";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { RowListSkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor } from "@/constants/theme";
import { formatNumber } from "@/utils/format";

import { AddButton } from "./record-row";

type RecordListScreenProps<T> = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  emptyMessage: string;
  /** "fornecedor"/"fornecedores" para o contador. */
  noun: [string, string];
  list: {
    items: T[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    query: string;
    setQuery: (q: string) => void;
    refresh: () => void;
  };
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  /** Sem `onAdd` (sem permissão), o botão flutuante não aparece. */
  addLabel?: string;
  onAdd?: () => void;
  header?: ReactNode;
  children?: ReactNode;
};

/** Esqueleto comum das telas de cadastro: busca, lista, pull-to-refresh e botão novo. */
export function RecordListScreen<T>({
  title,
  subtitle,
  searchPlaceholder,
  emptyIcon,
  emptyMessage,
  noun,
  list,
  renderItem,
  keyExtractor,
  addLabel = "Novo",
  onAdd,
  header,
  children,
}: RecordListScreenProps<T>) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title={title} subtitle={subtitle} leading={{ type: "back", onPress: router.back }} />
      <View className="px-three py-three border-b-hairline border-line">
        <SearchInput placeholder={searchPlaceholder} value={list.query} onChangeText={list.setQuery} returnKeyType="search" />
      </View>
      <FlatList
        data={list.loading ? [] : list.items}
        keyExtractor={keyExtractor}
        contentContainerClassName="w-full max-w-content self-center gap-two p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={BrandColor} />}
        ListHeaderComponent={
          <View className="mb-one gap-three">
            {header}
            {!list.loading && !list.error && (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {formatNumber(list.items.length)} {list.items.length === 1 ? noun[0] : noun[1]}
              </ThemedText>
            )}
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <RowListSkeleton />
          ) : (
            <EmptyState
              icon={emptyIcon}
              message={list.error ?? (list.query ? "Nada encontrado." : emptyMessage)}
              error={Boolean(list.error)}
              onRetry={list.error ? list.refresh : undefined}
            />
          )
        }
        renderItem={({ item }) => renderItem(item)}
      />
      {onAdd && <AddButton label={addLabel} onPress={onAdd} />}
      {children}
    </View>
  );
}
