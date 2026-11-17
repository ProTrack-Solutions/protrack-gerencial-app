import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/login/gradient-button";
import { BarcodeScanner } from "@/components/product/barcode-scanner";
import { Checkbox } from "@/components/product/checkbox";
import { FormInput, FormLabel } from "@/components/product/form-field";
import { round2 } from "@/components/purchases/format";
import { CatalogPicker, catalogLabel, VendorSelect } from "@/components/purchases/pickers";
import { SectionCard } from "@/components/sale/section-card";
import { ThemedText } from "@/components/themed-text";
import { DateField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { CardListSkeleton } from "@/components/ui/list-skeletons";
import { MoneyInput } from "@/components/ui/money-input";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Gradients, Spacing } from "@/constants/theme";
import { useResource } from "@/hooks/use-resource";
import type { CatalogProduct, PurchaseOrderDetail, SavePurchaseOrderParams, Vendor } from "@/interfaces/purchases.interface";
import { getApiErrorMessage } from "@/service/api.service";
import {
  CreatePurchaseOrder,
  EmailPurchaseOrder,
  GetPurchaseOrder,
  ListActiveVendors,
  SearchCatalogProducts,
  SendPurchaseOrder,
  UpdatePurchaseOrder,
} from "@/service/purchases.service";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";

type FormItem = {
  product_id: string;
  label: string;
  sell_in_bulk: boolean;
  stock_quantity: number;
  current_cost: number;
  quantity: number;
  unit_cost: number;
};

const fromCatalog = (p: CatalogProduct): FormItem => ({
  product_id: p.id,
  label: catalogLabel(p),
  sell_in_bulk: p.sell_in_bulk,
  stock_quantity: p.quantity,
  current_cost: p.cost_price,
  quantity: 1,
  unit_cost: p.cost_price,
});

function QuantityField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const step = (delta: number) => {
    const next = Math.max(1, value + delta);
    if (next === value) return haptics.warning();
    haptics.select();
    onChange(next);
  };
  return (
    <View className="flex-row items-center rounded-two border border-line bg-paper">
      <Pressable onPress={() => step(-1)} accessibilityLabel="Diminuir" hitSlop={4} className="h-10 w-10 items-center justify-center active:bg-surface">
        <Ionicons name="remove" size={18} color="#000000" />
      </Pressable>
      <TextInput
        value={String(value)}
        onChangeText={(t) => onChange(Math.max(0, Number(t.replace(/\D/g, "").slice(0, 6)) || 0))}
        keyboardType="number-pad"
        selectTextOnFocus
        className="w-12 py-two text-center text-base font-bold text-ink"
      />
      <Pressable onPress={() => step(1)} accessibilityLabel="Aumentar" hitSlop={4} className="h-10 w-10 items-center justify-center active:bg-surface">
        <Ionicons name="add" size={18} color="#000000" />
      </Pressable>
    </View>
  );
}

function OrderForm({ order }: { order?: PurchaseOrderDetail }) {
  const insets = useSafeAreaInsets();
  const vendorsQuery = useResource((signal) => ListActiveVendors(signal), [], { errorMessage: "Não foi possível carregar os fornecedores." });
  const [vendor, setVendor] = useState<Vendor | null>(
    order ? { id: order.vendor_id, name: order.vendor_name, email: order.vendor_email, phone: "", is_active: true } : null,
  );
  const [expectedDate, setExpectedDate] = useState(order?.expected_date?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [items, setItems] = useState<FormItem[]>(
    () =>
      order?.items.map((it) => ({
        product_id: it.product_id,
        label: catalogLabel(it),
        sell_in_bulk: it.sell_in_bulk,
        stock_quantity: it.stock_quantity,
        current_cost: it.current_cost,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
      })) ?? [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [touched, setTouched] = useState(false);

  // E-mail do cadastro atualizado (o do pedido pode estar desatualizado).
  const vendorEmail = (vendorsQuery.data?.find((v) => v.id === vendor?.id)?.email || vendor?.email || "").trim();
  const alreadySent = order?.status === "sent";
  const total = round2(items.reduce((s, it) => s + it.quantity * it.unit_cost, 0));
  const invalidItem = items.find((it) => !(it.quantity > 0));

  const addProduct = (product: CatalogProduct) => {
    haptics.success();
    setItems((current) => {
      const index = current.findIndex((it) => it.product_id === product.id);
      if (index < 0) return [...current, fromCatalog(product)];
      return current.map((it, i) => (i === index ? { ...it, quantity: it.quantity + 1 } : it));
    });
  };

  const update = (productId: string, patch: Partial<FormItem>) =>
    setItems((current) => current.map((it) => (it.product_id === productId ? { ...it, ...patch } : it)));

  const remove = (item: FormItem) => {
    haptics.warning();
    Alert.alert("Remover item?", item.label, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => setItems((c) => c.filter((it) => it.product_id !== item.product_id)) },
    ]);
  };

  const onScanned = async (code: string) => {
    setScannerOpen(false);
    try {
      const results = await SearchCatalogProducts(code);
      const product = results.find((p) => p.barcode === code) ?? (results.length === 1 ? results[0] : undefined);
      if (product) addProduct(product);
      else {
        haptics.warning();
        Alert.alert("Produto não encontrado", `Nenhum produto com o código ${code}. Cadastre-o em Novo Produto.`);
      }
    } catch (error) {
      haptics.error();
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível buscar o produto."));
    }
  };

  const save = async (send: boolean) => {
    setTouched(true);
    if (!vendor || items.length === 0 || invalidItem) {
      haptics.warning();
      Alert.alert(
        "Falta pouco",
        [!vendor && "• Escolha o fornecedor.", items.length === 0 && "• Adicione ao menos um produto.", invalidItem && "• Informe a quantidade de todos os itens."]
          .filter(Boolean)
          .join("\n"),
      );
      return;
    }
    setSaving(send ? "send" : "draft");
    const params: SavePurchaseOrderParams = {
      vendor_id: vendor.id,
      expected_date: expectedDate || undefined,
      notes: notes.trim() || undefined,
      items: items.map((it) => ({ product_id: it.product_id, quantity: it.quantity, unit_cost: it.unit_cost })),
      send,
    };
    try {
      let saved = order ? await UpdatePurchaseOrder(order.id, params) : await CreatePurchaseOrder(params);
      // Na edição o envio é uma ação separada: o PUT só salva os dados.
      if (order && send && saved.can_send) saved = await SendPurchaseOrder(saved.id);
      haptics.success();

      const emailKind = send && sendEmail ? "sent" : alreadySent && sendEmail ? "updated" : null;
      let emailNote = "";
      if (emailKind && vendorEmail) {
        try {
          await EmailPurchaseOrder(saved.id, emailKind);
          emailNote = `\nE-mail enviado para ${vendorEmail}.`;
        } catch (error) {
          emailNote = `\nO e-mail não foi enviado: ${getApiErrorMessage(error, "erro inesperado")} Tente de novo pelo pedido.`;
        }
      }
      Alert.alert(order ? "Pedido atualizado" : `Pedido nº ${saved.number} criado`, `${send ? "Pedido enviado ao fornecedor." : "Salvo como rascunho."}${emailNote}`);
      router.replace({ pathname: "/pedido-compra", params: { id: saved.id } });
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(error, "Não foi possível salvar o pedido."));
      setSaving(null);
    }
  };

  const canSendNow = !order || order.can_send;

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerClassName="w-full max-w-content self-center gap-three p-three">
        <SectionCard title="Pedido" icon="document-text-outline">
          <View className="gap-two">
            <FormLabel label="Fornecedor" required />
            <VendorSelect
              vendors={vendorsQuery.data}
              loading={vendorsQuery.loading}
              error={vendorsQuery.error}
              value={vendor}
              onChange={setVendor}
              invalid={touched && !vendor}
            />
          </View>
          <View className="gap-two">
            <FormLabel label="Previsão de entrega" icon="calendar-outline" />
            <DateField value={expectedDate} onChange={setExpectedDate} placeholder="Sem previsão" minimumDate={new Date()} clearable />
          </View>
          <View className="gap-two">
            <FormLabel label="Observação" icon="chatbubble-outline" />
            <FormInput placeholder="Ex.: entregar pela manhã" value={notes} onChangeText={setNotes} multiline maxLength={500} />
          </View>
        </SectionCard>

        <SectionCard
          title="Produtos"
          icon="cube-outline"
          right={
            items.length > 0 ? (
              <ThemedText type="smallBold" themeColor="textSecondary" className="text-xs">
                {items.length} {items.length === 1 ? "item" : "itens"}
              </ThemedText>
            ) : undefined
          }
        >
          {items.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary" className={`text-center ${touched ? "text-danger" : ""}`}>
              Nenhum produto ainda. Busque pelo nome ou leia o código de barras.
            </ThemedText>
          )}
          {items.map((it) => (
            <View key={it.product_id} className="gap-two rounded-two bg-surface p-three">
              <View className="flex-row items-start gap-two">
                <View className="flex-1 gap-half">
                  <ThemedText type="smallBold">{it.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                    {it.sell_in_bulk ? "A granel" : `Estoque ${it.stock_quantity}`} · custo atual {formatCurrency(it.current_cost)}
                  </ThemedText>
                </View>
                <Pressable onPress={() => remove(it)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover ${it.label}`}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </Pressable>
              </View>
              <View className="flex-row items-center gap-two">
                <QuantityField value={it.quantity} onChange={(quantity) => update(it.product_id, { quantity })} />
                <View className="flex-1">
                  <MoneyInput value={it.unit_cost} onChange={(unit_cost) => update(it.product_id, { unit_cost })} />
                </View>
              </View>
              <ThemedText type="smallBold" className="text-right text-xs">
                Subtotal {formatCurrency(it.quantity * it.unit_cost)}
              </ThemedText>
            </View>
          ))}
          <View className="flex-row gap-two">
            <Pressable
              onPress={() => {
                haptics.tap();
                setPickerOpen(true);
              }}
              accessibilityRole="button"
              className="flex-1 flex-row items-center justify-center gap-two rounded-two border border-brand-line bg-brand-soft py-three active:opacity-70"
            >
              <Ionicons name="search" size={16} color="#4896EA" />
              <ThemedText type="smallBold" className="text-brand">
                Buscar produto
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.tap();
                setScannerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Ler código de barras"
              className="items-center justify-center rounded-two border border-line bg-paper px-four active:bg-surface"
            >
              <Ionicons name="barcode-outline" size={20} color="#000000" />
            </Pressable>
          </View>
        </SectionCard>

        {(canSendNow || alreadySent) && vendor && (
          <View className="rounded-three bg-paper p-three">
            {vendorEmail ? (
              <Checkbox
                label={alreadySent ? `Avisar ${vendorEmail} da alteração` : `Enviar por e-mail para ${vendorEmail}`}
                checked={sendEmail}
                onChange={setSendEmail}
              />
            ) : (
              <View className="flex-row items-start gap-two">
                <Ionicons name="mail-outline" size={16} color="#566176" />
                <ThemedText type="small" themeColor="textSecondary" className="flex-1 text-xs">
                  O fornecedor não tem e-mail cadastrado. Depois de salvar, você pode compartilhar o PDF do pedido pelo WhatsApp.
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </KeyboardAwareScrollView>

      <View
        className="gap-three bg-paper px-four pt-three"
        style={{ paddingBottom: insets.bottom + Spacing.three, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#DEE5ED" }}
      >
        <View className="flex-row items-end justify-between">
          <View>
            <ThemedText type="small" themeColor="textSecondary" className="text-[11px] tracking-widest">
              TOTAL DO PEDIDO
            </ThemedText>
            <ThemedText className="text-2xl font-bold">{formatCurrency(total)}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" className="max-w-[55%] text-right text-xs">
            Estoque e financeiro só mudam no recebimento.
          </ThemedText>
        </View>
        <View className="flex-row gap-three">
          {(!order || order.status === "draft") && (
            <Pressable
              onPress={() => save(false)}
              disabled={saving !== null}
              className={`items-center justify-center rounded-two border border-line bg-paper px-four active:bg-surface ${saving ? "opacity-60" : ""}`}
              accessibilityRole="button"
            >
              <ThemedText type="smallBold">{saving === "draft" ? "Salvando..." : "Rascunho"}</ThemedText>
            </Pressable>
          )}
          <GradientButton
            label={
              saving === "send"
                ? "Salvando..."
                : order && order.status !== "draft"
                  ? "Salvar alterações"
                  : "Salvar e enviar"
            }
            icon={order && order.status !== "draft" ? "checkmark-circle-outline" : "send-outline"}
            colors={Gradients.primary}
            disabled={saving !== null}
            onPress={() => save(!order || order.status === "draft")}
            className={`flex-1 ${saving ? "opacity-60" : ""}`}
          />
        </View>
      </View>

      <CatalogPicker
        visible={pickerOpen}
        selectedIds={items.map((it) => it.product_id)}
        onClose={() => setPickerOpen(false)}
        onSelect={addProduct}
        onScan={() => setScannerOpen(true)}
      />
      <BarcodeScanner visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={onScanned} />
    </View>
  );
}

/** Novo pedido de compra; com `id`, edita um rascunho ou pedido enviado sem recebimentos. */
export default function PurchaseOrderFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, loading, error, refresh } = useResource((signal) => GetPurchaseOrder(id as string, signal), [id], {
    errorMessage: "Não foi possível carregar o pedido.",
    enabled: Boolean(id),
  });

  const confirmLeave = () =>
    Alert.alert("Sair sem salvar?", "As alterações do pedido serão perdidas.", [
      { text: "Continuar editando", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: router.back },
    ]);

  useEffect(() => {
    if (data && !data.can_edit) {
      Alert.alert("Não é possível editar", "O pedido só pode ser alterado enquanto está em rascunho ou enviado, sem recebimentos.");
      router.back();
    }
  }, [data]);

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title={id ? `Editar pedido${data ? ` nº ${data.number}` : ""}` : "Novo pedido de compra"}
        subtitle="Produtos, quantidades e custo combinado."
        leading={{ type: "back", onPress: confirmLeave }}
      />
      {!id ? (
        <OrderForm />
      ) : loading ? (
        <View className="p-three">
          <CardListSkeleton count={3} />
        </View>
      ) : error || !data ? (
        <EmptyState icon="cube-outline" message={error ?? "Pedido não encontrado."} error onRetry={refresh} />
      ) : (
        <OrderForm order={data} />
      )}
    </View>
  );
}
