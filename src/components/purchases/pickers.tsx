import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/sale/bottom-sheet";
import { ListState } from "@/components/sale/list-state";
import { SearchInput } from "@/components/sale/search-input";
import { ThemedText } from "@/components/themed-text";
import { BrandColor } from "@/constants/theme";
import { useRemoteSearch } from "@/hooks/use-remote-search";
import type { CatalogProduct, Vendor } from "@/interfaces/purchases.interface";
import { SearchCatalogProducts } from "@/service/purchases.service";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";

const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#DEE5ED" };

/** Nome do produto com a variação da grade: "Camiseta · Azul · M". */
export function catalogLabel(p: { product_name?: string; name?: string; color: string; size: string }) {
  return [p.product_name ?? p.name, p.color, p.size].filter(Boolean).join(" · ");
}

type VendorSelectProps = {
  vendors: Vendor[] | null;
  loading: boolean;
  error: string | null;
  value: Vendor | null;
  onChange: (vendor: Vendor) => void;
  invalid?: boolean;
};

/** Campo que abre a lista de fornecedores ativos com busca local. */
export function VendorSelect({ vendors, loading, error, value, onChange, invalid }: VendorSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = (vendors ?? []).filter((v) => !q || v.name.toLowerCase().includes(q));

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        className={`flex-row items-center gap-three rounded-two border bg-field p-three active:opacity-70 ${invalid ? "border-danger" : "border-line"}`}
      >
        <Ionicons name="business-outline" size={18} color={value ? BrandColor : "#8A94A6"} />
        <View className="flex-1">
          <ThemedText className={value ? "" : "text-placeholder"}>{value?.name ?? "Selecione o fornecedor"}</ThemedText>
          {value?.email ? (
            <ThemedText type="small" themeColor="textSecondary" className="text-xs">
              {value.email}
            </ThemedText>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={18} color="#566176" />
      </Pressable>

      <BottomSheet visible={open} title="Fornecedor" onClose={() => setOpen(false)}>
        <SearchInput placeholder="Buscar fornecedor" value={query} onChangeText={setQuery} />
        <FlatList
          data={loading ? [] : filtered}
          keyExtractor={(v) => v.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<ListState loading={loading} error={error} emptyMessage="Nenhum fornecedor ativo. Cadastre em Configurações." />}
          renderItem={({ item }) => {
            const selected = item.id === value?.id;
            return (
              <Pressable
                onPress={() => {
                  haptics.select();
                  onChange(item);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex-row items-center gap-three py-three active:opacity-60"
                style={divider}
              >
                <View className="flex-1 gap-half">
                  <ThemedText className={selected ? "font-bold text-brand" : ""}>{item.name}</ThemedText>
                  {item.email || item.phone ? (
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      {[item.email, item.phone].filter(Boolean).join(" · ")}
                    </ThemedText>
                  ) : null}
                </View>
                {selected && <Ionicons name="checkmark-circle" size={20} color={BrandColor} />}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </>
  );
}

type CatalogPickerProps = {
  visible: boolean;
  /** Já no pedido: aparecem marcados. */
  selectedIds: string[];
  onClose: () => void;
  onSelect: (product: CatalogProduct) => void;
  onScan: () => void;
};

/** Busca no catálogo (nome ou código de barras) para incluir no pedido. */
export function CatalogPicker({ visible, selectedIds, onClose, onSelect, onScan }: CatalogPickerProps) {
  const [query, setQuery] = useState("");
  const { results, loading, error } = useRemoteSearch(query, visible, SearchCatalogProducts);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="Adicionar produto" onClose={close}>
      <View className="flex-row items-center gap-two">
        <View className="flex-1">
          <SearchInput placeholder="Nome ou código de barras" value={query} onChangeText={setQuery} autoFocus />
        </View>
        <Pressable
          onPress={() => {
            close();
            onScan();
          }}
          accessibilityRole="button"
          accessibilityLabel="Ler código de barras"
          className="h-11 w-11 items-center justify-center rounded-two bg-brand active:opacity-80"
        >
          <Ionicons name="barcode-outline" size={22} color="#ffffff" />
        </Pressable>
      </View>
      <FlatList
        data={loading ? [] : results}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<ListState loading={loading} error={error} emptyMessage="Nenhum produto encontrado." />}
        renderItem={({ item }) => {
          const added = selectedIds.includes(item.id);
          return (
            <Pressable
              onPress={() => {
                onSelect(item);
                close();
              }}
              className="flex-row items-center gap-three py-three active:opacity-60"
              style={divider}
            >
              <View className="flex-1 gap-half">
                <ThemedText>{catalogLabel(item)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                  {[item.barcode, item.sell_in_bulk ? "A granel" : `${item.quantity} em estoque`, `custo ${formatCurrency(item.cost_price)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </ThemedText>
              </View>
              {added ? (
                <ThemedText type="smallBold" className="text-xs text-brand">
                  No pedido
                </ThemedText>
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={BrandColor} />
              )}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}
