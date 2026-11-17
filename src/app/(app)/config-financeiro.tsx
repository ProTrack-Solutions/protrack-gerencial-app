import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { OptionChips } from "@/components/product/option-chips";
import { PAYMENT_METHODS } from "@/components/sale/payment-method-grid";
import { SectionCard } from "@/components/sale/section-card";
import { RecordRow } from "@/components/settings/record-row";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSheet } from "@/components/ui/form-sheet";
import { RowListSkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useRecordList } from "@/hooks/use-record-list";
import type { BillCategoryRecord } from "@/interfaces/settings.interface";
import { getApiErrorMessage } from "@/service/api.service";
import {
  CreateBillCategory,
  CreatePaymentMethod,
  DeleteBillCategory,
  ListBillCategoryRecords,
  ListPaymentMethods,
  ToggleBillCategory,
  TogglePaymentMethod,
} from "@/service/settings.service";
import { haptics } from "@/utils/haptics";
import { paymentMethodColor, paymentMethodName } from "@/utils/payment-methods";

function PaymentMethodSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("pix");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName("");
    setType("pix");
    setError(undefined);
  }, [visible]);

  const save = async () => {
    if (name.trim().length < 2) {
      setError("Informe o nome que aparece na venda.");
      return haptics.warning();
    }
    setSaving(true);
    try {
      await CreatePaymentMethod({ name: name.trim(), type });
      haptics.success();
      onSaved();
      onClose();
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(e, "Não foi possível criar a forma de pagamento."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Nova forma de pagamento"
      subtitle="Aparece na baixa de parcelas e nos relatórios."
      icon="card-outline"
      onClose={onClose}
      submit={{ label: saving ? "Salvando..." : "Salvar", icon: "checkmark-circle-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Tipo" required />
        <OptionChips
          options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
          value={type}
          onChange={(v) => {
            haptics.select();
            setType(v);
            if (!name.trim()) setName(paymentMethodName(v));
          }}
        />
      </View>
      <View className="gap-two">
        <FormLabel label="Nome" required />
        <FormInput value={name} onChangeText={setName} placeholder="Ex.: Pix Banco do Brasil" error={error} />
        <FieldError message={error} />
      </View>
    </FormSheet>
  );
}

function BillCategorySheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName("");
    setDescription("");
    setError(undefined);
  }, [visible]);

  const save = async () => {
    if (name.trim().length < 2) {
      setError("Informe o nome da categoria.");
      return haptics.warning();
    }
    setSaving(true);
    try {
      await CreateBillCategory({ name: name.trim(), description: description.trim() });
      haptics.success();
      onSaved();
      onClose();
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(e, "Não foi possível criar a categoria."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Nova categoria de conta"
      subtitle="Agrupa as contas a pagar (aluguel, fornecedores, salários...)."
      icon="folder-outline"
      onClose={onClose}
      submit={{ label: saving ? "Salvando..." : "Salvar", icon: "checkmark-circle-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Nome" required />
        <FormInput value={name} onChangeText={setName} placeholder="Ex.: Aluguel" error={error} />
        <FieldError message={error} />
      </View>
      <View className="gap-two">
        <FormLabel label="Descrição" />
        <FormInput value={description} onChangeText={setDescription} placeholder="Opcional" multiline maxLength={300} />
      </View>
    </FormSheet>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      className="items-center rounded-two border border-dashed border-brand-line bg-brand-soft py-three active:opacity-70"
    >
      <ThemedText type="smallBold" className="text-brand">
        + {label}
      </ThemedText>
    </Pressable>
  );
}

/** Formas de pagamento e categorias das contas a pagar. Escrita só para ADMIN. */
export default function FinancialSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const methods = useRecordList(ListPaymentMethods, { errorMessage: "Não foi possível carregar as formas de pagamento.", searchText: (m) => m.name });
  const categories = useRecordList(ListBillCategoryRecords, { errorMessage: "Não foi possível carregar as categorias.", searchText: (c) => c.name });
  const [methodOpen, setMethodOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const removeCategory = (c: BillCategoryRecord) => {
    haptics.warning();
    Alert.alert("Excluir categoria?", `"${c.name}" deixa de aparecer nas contas a pagar.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await DeleteBillCategory(c.id);
            haptics.success();
            categories.reload();
          } catch (e) {
            haptics.error();
            Alert.alert("Não foi possível excluir", getApiErrorMessage(e, "A categoria pode estar em uso. Desative em vez de excluir."));
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Financeiro" subtitle={admin ? "Formas de pagamento e categorias." : "Só o administrador pode alterar."} leading={{ type: "back", onPress: router.back }} />
      <ScrollView
        contentContainerClassName="w-full max-w-content self-center gap-three p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={methods.refreshing || categories.refreshing}
            onRefresh={() => {
              methods.refresh();
              categories.refresh();
            }}
            tintColor={BrandColor}
          />
        }
      >
        <SectionCard title="Formas de pagamento" icon="card-outline">
          {methods.loading ? (
            <RowListSkeleton count={3} />
          ) : methods.error ? (
            <EmptyState icon="card-outline" message={methods.error} error onRetry={methods.refresh} />
          ) : (
            methods.items.map((m) => (
              <RecordRow
                key={m.id}
                title={m.name}
                subtitle={paymentMethodName(m.type)}
                icon="card-outline"
                color={paymentMethodColor(m.type)}
                active={m.is_active}
                toggling={methods.togglingId === m.id}
                onToggle={admin ? (value) => methods.toggle(m, { is_active: value }, () => TogglePaymentMethod(m.id, value)) : undefined}
              />
            ))
          )}
          {admin && <AddRow label="Nova forma de pagamento" onPress={() => setMethodOpen(true)} />}
        </SectionCard>

        <SectionCard title="Categorias de contas a pagar" icon="folder-outline">
          {categories.loading ? (
            <RowListSkeleton count={3} />
          ) : categories.error ? (
            <EmptyState icon="folder-outline" message={categories.error} error onRetry={categories.refresh} />
          ) : categories.items.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              Nenhuma categoria cadastrada.
            </ThemedText>
          ) : (
            categories.items.map((c) => (
              <RecordRow
                key={c.id}
                title={c.name}
                subtitle={c.description || undefined}
                icon="folder-outline"
                color="#0E7490"
                active={c.is_active}
                toggling={categories.togglingId === c.id}
                onPress={admin ? () => removeCategory(c) : undefined}
                onToggle={admin ? (value) => categories.toggle(c, { is_active: value }, () => ToggleBillCategory(c.id, value)) : undefined}
              />
            ))
          )}
          {admin && (
            <>
              <AddRow label="Nova categoria" onPress={() => setCategoryOpen(true)} />
              <ThemedText type="small" themeColor="textSecondary" className="text-center text-xs">
                Toque em uma categoria para excluir.
              </ThemedText>
            </>
          )}
        </SectionCard>
      </ScrollView>

      <PaymentMethodSheet visible={methodOpen} onClose={() => setMethodOpen(false)} onSaved={methods.reload} />
      <BillCategorySheet visible={categoryOpen} onClose={() => setCategoryOpen(false)} onSaved={categories.reload} />
    </View>
  );
}
