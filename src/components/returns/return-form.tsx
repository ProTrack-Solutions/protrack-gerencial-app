import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/login/gradient-button";
import { BarcodeScanner } from "@/components/product/barcode-scanner";
import { Checkbox } from "@/components/product/checkbox";
import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { OptionChips } from "@/components/product/option-chips";
import { ClientSelect } from "@/components/sale/client-select";
import { ProductPicker } from "@/components/sale/product-picker";
import { SectionCard } from "@/components/sale/section-card";
import { ThemedText } from "@/components/themed-text";
import { Segmented } from "@/components/ui/filter-chips";
import { MoneyInput } from "@/components/ui/money-input";
import { Gradients, Spacing } from "@/constants/theme";
import type {
  CreateReturnParams,
  RefundMethod,
  ReturnDestination,
  ReturnDetail,
  ReturnKind,
  ReturnReason,
  ReturnableSale,
} from "@/interfaces/returns.interface";
import type { Customer, Product } from "@/interfaces/sale.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { CreateReturn } from "@/service/returns.service";
import { SearchProducts } from "@/service/sale.service";
import { formatDate, formatDateTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { paymentMethodName } from "@/utils/payment-methods";

import { REASONS, REFUND_METHODS, allocate, lineReturnAmount } from "./format";

type NewItem = { product: Product; quantity: number };

/** Produto vendido a granel (kg, m...) não tem limite de estoque. */
const isBulk = (p: Product) => Boolean(p.unit) && p.unit.toUpperCase() !== "UN";

function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  const change = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), max);
    if (clamped === value) return haptics.warning();
    haptics.select();
    onChange(clamped);
  };
  return (
    <View className="flex-row items-center rounded-two border border-line bg-paper">
      <Pressable
        onPress={() => change(value - 1)}
        disabled={value <= 0}
        accessibilityRole="button"
        accessibilityLabel={`Diminuir ${label}`}
        hitSlop={4}
        className={`h-9 w-9 items-center justify-center ${value <= 0 ? "opacity-30" : "active:bg-surface"}`}
      >
        <Ionicons name="remove" size={18} color="#000000" />
      </Pressable>
      <ThemedText type="smallBold" className="w-8 text-center">
        {value}
      </ThemedText>
      <Pressable
        onPress={() => change(value + 1)}
        accessibilityRole="button"
        accessibilityLabel={`Aumentar ${label}`}
        hitSlop={4}
        className={`h-9 w-9 items-center justify-center ${value >= max ? "opacity-30" : "active:bg-surface"}`}
      >
        <Ionicons name="add" size={18} color="#000000" />
      </Pressable>
    </View>
  );
}

function Row({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-three py-one">
      <ThemedText type={strong ? "smallBold" : "small"} themeColor={strong ? undefined : "textSecondary"} className="flex-1">
        {label}
      </ThemedText>
      <ThemedText className={`${strong ? "text-lg font-bold" : "text-sm font-medium"} ${className ?? ""}`}>{value}</ThemedText>
    </View>
  );
}

type ReturnFormProps = {
  sale: ReturnableSale;
  onCancel: () => void;
  onCreated: (created: ReturnDetail) => void;
};

export function ReturnForm({ sale, onCancel, onCreated }: ReturnFormProps) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<ReturnKind>("return");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [damaged, setDamaged] = useState<Record<string, boolean>>({});
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [destination, setDestination] = useState<ReturnDestination>("credit");
  const [refundMethod, setRefundMethod] = useState<RefundMethod | "">("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [differenceMethod, setDifferenceMethod] = useState<RefundMethod | "">("");
  const [amountReceived, setAmountReceived] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const blocked = !sale.within_window && !sale.can_override;

  const returnedTotal = useMemo(
    () =>
      Math.round(
        sale.items.reduce(
          (sum, it) =>
            sum + lineReturnAmount(it.net_total, it.returned_total, it.quantity, it.returned_quantity, quantities[it.sale_item_id] ?? 0) * 100,
          0,
        ),
      ) / 100,
    [sale.items, quantities],
  );
  const returnedUnits = Object.values(quantities).reduce((s, q) => s + q, 0);
  const exchangeTotal =
    kind === "exchange" ? Math.round(newItems.reduce((s, it) => s + it.product.sale_price * it.quantity * 100, 0)) / 100 : 0;
  const alloc = allocate(returnedTotal, exchangeTotal, sale.open_debt);
  const hasCustomer = Boolean(sale.customer_id);
  const change = Math.max(amountReceived - alloc.difference, 0);

  const problems: string[] = [];
  if (returnedUnits === 0) problems.push("Escolha os itens que o cliente está devolvendo.");
  if (kind === "exchange" && newItems.length === 0) problems.push("Adicione o que o cliente vai levar na troca.");
  if (!reason) problems.push("Informe o motivo.");
  if (!sale.within_window && sale.can_override && !overrideReason.trim())
    problems.push("Explique por que a troca está sendo aceita fora do prazo.");
  if (alloc.rest > 0 && destination === "credit" && !hasCustomer && !customer) problems.push("Escolha o cliente que vai receber o vale-troca.");
  if (alloc.rest > 0 && destination === "refund" && !refundMethod) problems.push("Escolha como o dinheiro será devolvido.");
  if (alloc.difference > 0 && !differenceMethod) problems.push("Escolha como o cliente paga a diferença.");
  if (alloc.difference > 0 && differenceMethod === "cash" && amountReceived > 0 && amountReceived < alloc.difference)
    problems.push("O valor recebido é menor que a diferença.");

  const addProduct = (product: Product) => {
    haptics.success();
    setNewItems((prev) => {
      const index = prev.findIndex((it) => it.product.id === product.id);
      if (index < 0) return [...prev, { product, quantity: 1 }];
      const max = isBulk(product) ? 9999 : product.quantity;
      return prev.map((it, i) => (i === index ? { ...it, quantity: Math.min(it.quantity + 1, max) } : it));
    });
  };

  // Lê o código de barras da etiqueta e adiciona o produto à troca.
  const onScanned = async (code: string) => {
    setScannerOpen(false);
    setScanning(true);
    try {
      const results = await SearchProducts(code);
      const product = results.find((p) => p.barcode === code) ?? (results.length === 1 ? results[0] : undefined);
      if (!product) {
        haptics.warning();
        Alert.alert("Produto não encontrado", `Nenhum produto com o código ${code}.`);
      } else if (!isBulk(product) && product.quantity <= 0) {
        haptics.warning();
        Alert.alert("Sem estoque", `${product.name} está sem estoque.`);
      } else {
        addProduct(product);
      }
    } catch (error) {
      haptics.error();
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível buscar o produto."));
    } finally {
      setScanning(false);
    }
  };

  const submit = async () => {
    if (blocked) return;
    if (problems.length > 0) {
      haptics.warning();
      Alert.alert("Falta pouco", problems.map((p) => `• ${p}`).join("\n"));
      return;
    }
    const payload: CreateReturnParams = {
      sale_id: sale.sale_id,
      kind,
      reason: reason as ReturnReason,
      items: sale.items
        .filter((it) => (quantities[it.sale_item_id] ?? 0) > 0)
        .map((it) => ({ sale_item_id: it.sale_item_id, quantity: quantities[it.sale_item_id], restock: !damaged[it.sale_item_id] })),
      notes: notes.trim() || undefined,
      override_reason: !sale.within_window ? overrideReason.trim() : undefined,
    };
    if (kind === "exchange") payload.new_items = newItems.map((it) => ({ product_id: it.product.id, quantity: it.quantity }));
    if (alloc.rest > 0) {
      payload.destination = destination;
      if (destination === "refund") payload.refund_method = refundMethod as RefundMethod;
    }
    if (!hasCustomer && customer) payload.customer_id = customer.id;
    if (alloc.difference > 0) {
      payload.difference_method = differenceMethod as RefundMethod;
      if (differenceMethod === "cash" && amountReceived > 0) payload.amount_received = amountReceived;
    }

    setSubmitting(true);
    try {
      const created = await CreateReturn(payload);
      haptics.success();
      onCreated(created);
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao registrar", getApiErrorMessage(error, "Não foi possível registrar a devolução."));
      setSubmitting(false);
    }
  };

  const resultLine =
    alloc.difference > 0
      ? { label: "Cliente paga a diferença", value: alloc.difference, className: "text-blue-700" }
      : alloc.rest > 0
        ? {
            label: destination === "credit" ? "Vale-troca para o cliente" : "Devolver ao cliente",
            value: alloc.rest,
            className: destination === "credit" ? "text-pink-700" : "text-emerald-700",
          }
        : { label: "Sem diferença", value: 0, className: "" };

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-content self-center gap-three p-three"
      >
        {/* Venda */}
        <View className="gap-two rounded-three bg-paper p-three">
          <View className="flex-row items-start gap-three">
            <View className="flex-1 gap-half">
              <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
                VENDA #{sale.sale_id.slice(0, 8).toUpperCase()}
              </ThemedText>
              <ThemedText className="text-lg font-bold" numberOfLines={1}>
                {sale.customer_name || "Consumidor final"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                {formatDateTime(sale.created_at)} · {paymentMethodName(sale.payment_method)}
              </ThemedText>
            </View>
            <View className="items-end gap-half">
              <ThemedText className="font-bold">{formatCurrency(sale.total_amount)}</ThemedText>
              {sale.open_debt > 0 && (
                <ThemedText type="small" className="text-xs text-amber-700">
                  {formatCurrency(sale.open_debt)} em aberto
                </ThemedText>
              )}
              {sale.customer_credit > 0 && (
                <ThemedText type="small" className="text-xs text-pink-700">
                  Vale atual {formatCurrency(sale.customer_credit)}
                </ThemedText>
              )}
            </View>
          </View>
          {!sale.within_window ? (
            <View className={`gap-two rounded-two p-three ${sale.can_override ? "bg-amber-50" : "bg-rose-50"}`}>
              <View className="flex-row items-start gap-two">
                <Ionicons name="shield-outline" size={16} color={sale.can_override ? "#B45309" : "#BE123C"} />
                <ThemedText type="small" className={`flex-1 ${sale.can_override ? "text-amber-800" : "text-rose-800"}`}>
                  O prazo de troca ({sale.window_days} dias) terminou em {sale.deadline ? formatDate(sale.deadline) : "—"}.{" "}
                  {sale.can_override
                    ? "Como administrador, você pode aceitar informando o motivo."
                    : "Só um administrador pode aceitar esta troca."}
                </ThemedText>
              </View>
              {sale.can_override && (
                <FormInput
                  placeholder="Motivo da exceção (ex.: defeito de fábrica)"
                  value={overrideReason}
                  onChangeText={setOverrideReason}
                  maxLength={500}
                />
              )}
            </View>
          ) : sale.deadline ? (
            <ThemedText type="small" themeColor="textSecondary" className="text-xs">
              Prazo de troca até {formatDate(sale.deadline)}.
            </ThemedText>
          ) : null}
        </View>

        {/* Tipo */}
        <View className="flex-row gap-two">
          {(
            [
              { value: "return", icon: "return-down-back", title: "Devolução", text: "Recebe vale ou dinheiro" },
              { value: "exchange", icon: "swap-horizontal", title: "Troca", text: "Leva outros produtos" },
            ] as const
          ).map((option) => {
            const active = kind === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  if (active) return;
                  haptics.select();
                  setKind(option.value);
                }}
                disabled={blocked}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className={`flex-1 gap-one rounded-three border p-three active:opacity-70 ${
                  active ? "border-brand bg-brand-soft" : "border-line bg-paper"
                } ${blocked ? "opacity-50" : ""}`}
              >
                <Ionicons name={option.icon} size={20} color={active ? "#4896EA" : "#566176"} />
                <ThemedText type="smallBold" className={active ? "text-brand" : ""}>
                  {option.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                  {option.text}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Itens devolvidos */}
        <SectionCard title="O que está voltando" icon="cube-outline">
          <ThemedText type="small" themeColor="textSecondary" className="-mt-two text-xs">
            Valor pago, já com o desconto da venda.
          </ThemedText>
          {sale.items.map((it) => {
            const qty = quantities[it.sale_item_id] ?? 0;
            const amount = lineReturnAmount(it.net_total, it.returned_total, it.quantity, it.returned_quantity, qty);
            const done = it.available === 0;
            return (
              <View key={it.sale_item_id} className={`gap-two rounded-two p-three ${qty > 0 ? "bg-brand-soft" : "bg-surface"} ${done ? "opacity-50" : ""}`}>
                <View className="flex-row items-center gap-three">
                  <View className="flex-1 gap-half">
                    <ThemedText type="smallBold">{it.product_name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      {formatCurrency(it.unit_amount)} cada · comprou {it.quantity}
                      {it.returned_quantity > 0 ? ` · já devolveu ${it.returned_quantity}` : ""}
                    </ThemedText>
                  </View>
                  {done ? (
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      Tudo devolvido
                    </ThemedText>
                  ) : (
                    <Stepper
                      value={qty}
                      max={it.available}
                      label={it.product_name}
                      onChange={(v) => setQuantities((prev) => ({ ...prev, [it.sale_item_id]: v }))}
                    />
                  )}
                </View>
                {qty > 0 && (
                  <View className="flex-row items-center justify-between">
                    {it.sell_in_bulk ? (
                      <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                        A granel: não controla estoque
                      </ThemedText>
                    ) : (
                      <Checkbox
                        label="Avariado (não volta ao estoque)"
                        checked={Boolean(damaged[it.sale_item_id])}
                        onChange={(v) => {
                          haptics.select();
                          setDamaged((prev) => ({ ...prev, [it.sale_item_id]: v }));
                        }}
                      />
                    )}
                    <ThemedText type="smallBold">{formatCurrency(amount)}</ThemedText>
                  </View>
                )}
              </View>
            );
          })}
        </SectionCard>

        {/* Itens novos */}
        {kind === "exchange" && (
          <SectionCard title="O que o cliente vai levar" icon="bag-handle-outline">
            {newItems.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" className="text-center">
                Nenhum produto ainda. Busque ou leia o código de barras.
              </ThemedText>
            ) : (
              newItems.map((it, index) => (
                <View key={it.product.id} className="flex-row items-center gap-three rounded-two bg-surface p-three">
                  <View className="flex-1 gap-half">
                    <ThemedText type="smallBold">{it.product.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      {formatCurrency(it.product.sale_price)} cada
                      {!isBulk(it.product) ? ` · estoque ${it.product.quantity}` : ""}
                    </ThemedText>
                    <ThemedText type="smallBold" className="text-xs">
                      {formatCurrency(it.product.sale_price * it.quantity)}
                    </ThemedText>
                  </View>
                  <Stepper
                    value={it.quantity}
                    max={isBulk(it.product) ? 9999 : it.product.quantity}
                    label={it.product.name}
                    onChange={(v) =>
                      setNewItems((prev) =>
                        v === 0 ? prev.filter((_, i) => i !== index) : prev.map((p, i) => (i === index ? { ...p, quantity: v } : p)),
                      )
                    }
                  />
                </View>
              ))
            )}
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
                disabled={scanning}
                accessibilityRole="button"
                accessibilityLabel="Ler código de barras"
                className="flex-row items-center justify-center gap-two rounded-two border border-line bg-paper px-four py-three active:bg-surface"
              >
                {scanning ? <ActivityIndicator size="small" /> : <Ionicons name="barcode-outline" size={18} color="#000000" />}
              </Pressable>
            </View>
          </SectionCard>
        )}

        {/* Motivo */}
        <SectionCard title="Motivo" icon="help-circle-outline">
          <OptionChips
            options={REASONS}
            value={reason}
            onChange={(v) => {
              haptics.select();
              setReason(v);
            }}
          />
          <FormInput placeholder="Observação (opcional)" value={notes} onChangeText={setNotes} multiline maxLength={500} />
        </SectionCard>

        {/* Resumo e destino do valor */}
        <SectionCard title="Resumo" icon="receipt-outline">
          <View>
            <Row label={`Devolvido (${returnedUnits} ${returnedUnits === 1 ? "item" : "itens"})`} value={formatCurrency(returnedTotal)} />
            {kind === "exchange" && <Row label="Itens novos" value={formatCurrency(exchangeTotal)} />}
            {alloc.debtReduction > 0 && (
              <Row label="Abatido das parcelas em aberto" value={formatCurrency(alloc.debtReduction)} className="text-amber-700" />
            )}
            <View className="mt-one border-t-hairline border-line pt-one">
              <Row label={resultLine.label} value={formatCurrency(resultLine.value)} strong className={resultLine.className} />
            </View>
          </View>

          {sale.open_debt > 0 && returnedTotal > 0 && (
            <ThemedText type="small" className="rounded-two bg-amber-50 p-three text-xs text-amber-800">
              A venda tem {formatCurrency(sale.open_debt)} em parcelas abertas: o valor devolvido abate delas antes de virar vale ou
              dinheiro.
            </ThemedText>
          )}

          {alloc.rest > 0 && (
            <View className="gap-three">
              <Segmented
                options={[
                  { value: "credit", label: "Vale-troca" },
                  { value: "refund", label: "Dinheiro de volta" },
                ]}
                value={destination}
                onChange={setDestination}
              />
              {destination === "credit" &&
                (hasCustomer ? (
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                    O vale fica no cadastro de {sale.customer_name} e pode ser usado em qualquer venda.
                  </ThemedText>
                ) : (
                  <View className="gap-two">
                    <FormLabel label="Cliente que recebe o vale" required />
                    <ClientSelect value={customer} onChange={setCustomer} />
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      A venda foi sem cliente: escolha um.
                    </ThemedText>
                  </View>
                ))}
              {destination === "refund" && (
                <View className="gap-two">
                  <FormLabel label="Como devolver" required />
                  <OptionChips options={REFUND_METHODS} value={refundMethod} onChange={setRefundMethod} />
                  {refundMethod === "cash" && (
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      Sai da gaveta do caixa.
                    </ThemedText>
                  )}
                </View>
              )}
            </View>
          )}

          {alloc.difference > 0 && (
            <View className="gap-two">
              <FormLabel label="Pagamento da diferença" required />
              <OptionChips
                options={REFUND_METHODS}
                value={differenceMethod}
                onChange={(v) => {
                  setDifferenceMethod(v);
                  setAmountReceived(0);
                }}
              />
              {differenceMethod === "cash" && (
                <View className="gap-two">
                  <FormLabel label="Valor recebido (opcional)" />
                  <MoneyInput value={amountReceived} onChange={setAmountReceived} />
                  {amountReceived > 0 && amountReceived >= alloc.difference && (
                    <ThemedText type="small">
                      Troco: <ThemedText type="smallBold">{formatCurrency(change)}</ThemedText>
                    </ThemedText>
                  )}
                  {amountReceived > 0 && amountReceived < alloc.difference && <FieldError message="Menor que a diferença." />}
                </View>
              )}
            </View>
          )}
        </SectionCard>
      </KeyboardAwareScrollView>

      {/* Rodapé fixo com o resultado e a confirmação. */}
      <View
        className="gap-three bg-paper px-four pt-three"
        style={{ paddingBottom: insets.bottom + Spacing.three, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#DEE5ED" }}
      >
        {blocked ? (
          <View className="flex-row items-start gap-two rounded-two bg-rose-50 p-three">
            <Ionicons name="warning-outline" size={16} color="#BE123C" />
            <ThemedText type="small" className="flex-1 text-rose-800">
              Fora do prazo de troca. Peça para um administrador registrar.
            </ThemedText>
          </View>
        ) : (
          <View className="flex-row items-end justify-between">
            <View>
              <ThemedText type="small" themeColor="textSecondary" className="text-[11px] tracking-widest">
                {resultLine.label.toUpperCase()}
              </ThemedText>
              <ThemedText className={`text-2xl font-bold ${resultLine.className}`}>{formatCurrency(resultLine.value)}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {returnedUnits} {returnedUnits === 1 ? "item" : "itens"}
            </ThemedText>
          </View>
        )}
        <View className="flex-row gap-three">
          <Pressable
            onPress={onCancel}
            disabled={submitting}
            className="items-center justify-center rounded-two border border-line bg-paper px-four active:bg-surface"
            accessibilityRole="button"
          >
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
          <GradientButton
            label={submitting ? "Registrando..." : kind === "exchange" ? "Registrar troca" : "Registrar devolução"}
            icon={kind === "exchange" ? "swap-horizontal" : "return-down-back"}
            colors={Gradients.primary}
            disabled={blocked || submitting}
            onPress={submit}
            className={`flex-1 ${blocked || submitting || problems.length > 0 ? "opacity-60" : ""}`}
          />
        </View>
      </View>

      <ProductPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addProduct} />
      <BarcodeScanner visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={onScanned} />
    </View>
  );
}
