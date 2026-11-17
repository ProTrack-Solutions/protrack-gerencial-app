import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { RecordListScreen } from "@/components/settings/record-list-screen";
import { RecordRow } from "@/components/settings/record-row";
import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { useRecordList } from "@/hooks/use-record-list";
import type { ProductCategoryRecord } from "@/interfaces/settings.interface";
import { getApiErrorMessage } from "@/service/api.service";
import {
  CreateProductCategory,
  DeleteProductCategory,
  ListProductCategories,
  SetProductCategoryStatus,
  UpdateProductCategory,
} from "@/service/settings.service";
import { haptics } from "@/utils/haptics";

// Paleta em vez do seletor de cor do navegador: toque rápido no celular.
const COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#14b8a6", "#06b6d4", "#64748b"];

function CategorySheet({
  category,
  visible,
  onClose,
  onSaved,
}: {
  category: ProductCategoryRecord | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? "");
    setColor(category?.color || COLORS[0]);
    setError(undefined);
  }, [visible, category]);

  const save = async () => {
    if (name.trim().length < 2) {
      setError("Informe o nome da categoria.");
      return haptics.warning();
    }
    setSaving(true);
    try {
      if (category) await UpdateProductCategory(category.id, { name: name.trim(), color });
      else await CreateProductCategory({ name: name.trim(), color });
      haptics.success();
      onSaved();
      onClose();
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(e, "Não foi possível salvar a categoria."));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!category) return;
    haptics.warning();
    Alert.alert("Excluir categoria?", `"${category.name}" deixa de aparecer no cadastro de produtos.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await DeleteProductCategory(category.id);
            haptics.success();
            onSaved();
            onClose();
          } catch (e) {
            haptics.error();
            Alert.alert("Não foi possível excluir", getApiErrorMessage(e, "A categoria pode estar em uso por produtos. Desative em vez de excluir."));
          }
        },
      },
    ]);
  };

  return (
    <FormSheet
      visible={visible}
      title={category ? "Editar categoria" : "Nova categoria"}
      icon="pricetag-outline"
      colors={[color, color]}
      onClose={onClose}
      submit={{ label: saving ? "Salvando..." : "Salvar", icon: "checkmark-circle-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Nome" required />
        <FormInput value={name} onChangeText={setName} placeholder="Ex.: Camisetas" autoCapitalize="sentences" error={error} />
        <FieldError message={error} />
      </View>
      <View className="gap-two">
        <FormLabel label="Cor" />
        <View className="flex-row flex-wrap gap-three">
          {COLORS.map((c) => {
            const selected = c.toLowerCase() === color.toLowerCase();
            return (
              <Pressable
                key={c}
                onPress={() => {
                  haptics.select();
                  setColor(c);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Cor ${c}`}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: c, borderWidth: selected ? 3 : 0, borderColor: "#ffffff", elevation: selected ? 3 : 0 }}
              >
                {selected && <Ionicons name="checkmark" size={18} color="#ffffff" />}
              </Pressable>
            );
          })}
        </View>
      </View>
      <View className="flex-row items-center gap-two rounded-two bg-surface p-three">
        <ThemedText type="small" themeColor="textSecondary">
          Prévia:
        </ThemedText>
        <View className="rounded-full border px-three py-half" style={{ backgroundColor: `${color}20`, borderColor: color }}>
          <ThemedText type="smallBold" className="text-xs" style={{ color }}>
            {name.trim() || "Categoria"}
          </ThemedText>
        </View>
      </View>
      {category && (
        <Pressable onPress={remove} accessibilityRole="button" className="items-center py-two active:opacity-60">
          <ThemedText type="smallBold" className="text-danger">
            Excluir categoria
          </ThemedText>
        </Pressable>
      )}
    </FormSheet>
  );
}

export default function ProductCategoriesScreen() {
  const list = useRecordList(ListProductCategories, {
    errorMessage: "Não foi possível carregar as categorias.",
    searchText: (c) => c.name,
  });
  const [editing, setEditing] = useState<ProductCategoryRecord | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <RecordListScreen
      title="Categorias de produto"
      subtitle="Organize o estoque e os relatórios de margem."
      searchPlaceholder="Buscar categoria"
      emptyIcon="pricetags-outline"
      emptyMessage="Nenhuma categoria cadastrada."
      noun={["categoria", "categorias"]}
      list={list}
      keyExtractor={(c) => c.id}
      addLabel="Nova categoria"
      onAdd={() => {
        setEditing(null);
        setOpen(true);
      }}
      renderItem={(c) => (
        <RecordRow
          title={c.name}
          subtitle={c.status === "ACTIVE" ? "Ativa" : "Inativa"}
          icon="pricetag"
          color={c.color || "#64748b"}
          active={c.status === "ACTIVE"}
          toggling={list.togglingId === c.id}
          onPress={() => {
            setEditing(c);
            setOpen(true);
          }}
          onToggle={(value) =>
            list.toggle(c, { status: value ? "ACTIVE" : "INACTIVE" }, () => SetProductCategoryStatus(c.id, value ? "ACTIVE" : "INACTIVE"))
          }
        />
      )}
    >
      <CategorySheet category={editing} visible={open} onClose={() => setOpen(false)} onSaved={list.reload} />
    </RecordListScreen>
  );
}
