import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/login/gradient-button";
import { BarcodeScanner } from "@/components/product/barcode-scanner";
import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { OptionChips } from "@/components/product/option-chips";
import {
  addMonths,
  allocateLanded,
  averageCost,
  margin,
  round2,
  splitInstallments,
  unitMoney,
} from "@/components/purchases/format";
import { catalogLabel } from "@/components/purchases/pickers";
import { SectionCard } from "@/components/sale/section-card";
import { ThemedText } from "@/components/themed-text";
import { DateField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/filter-chips";
import { CardListSkeleton } from "@/components/ui/list-skeletons";
import { MoneyInput } from "@/components/ui/money-input";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Spacing } from "@/constants/theme";
import { useResource } from "@/hooks/use-resource";
import type { InstallmentParams, PurchaseOrderDetail } from "@/interfaces/purchases.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { GetPurchaseOrder, ListBillCategories, ReceivePurchaseOrder } from "@/service/purchases.service";
import { ListActivePaymentMethods } from "@/service/receivable.service";
import { formatPercent, formatCurrency } from "@/utils/format";
import { isoDaysFromToday } from "@/utils/dates";
import { haptics } from "@/utils/haptics";

const SUCCESS_GRADIENT = ["#059669", "#10B981"] as const;

type Line = { quantity: number; unitCost: number; salePrice: number | null };
type Interval = "30" | "15" | "7";

function ReceiveForm({ order }: { order: PurchaseOrderDetail }) {
  const insets = useSafeAreaInsets();
  const pending = useMemo(() => order.items.filter((it) => it.pending_quantity > 0), [order.items]);
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(pending.map((it) => [it.id, { quantity: it.pending_quantity, unitCost: it.unit_cost, salePrice: null }])),
  );
  const [receivedAt, setReceivedAt] = useState(isoDaysFromToday(0));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceSeries, setInvoiceSeries] = useState("");
  const [invoiceKey, setInvoiceKey] = useState("");
  const [freight, setFreight] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(1);
  const [firstDue, setFirstDue] = useState(() => addMonths(isoDaysFromToday(0), 1));
  const [interval, setIntervalDays] = useState<Interval>("30");
  const [custom, setCustom] = useState<InstallmentParams[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const categories = useResource((signal) => ListBillCategories(signal), [], { errorMessage: "" });
  const methods = useResource(() => ListActivePaymentMethods(), [], { errorMessage: "" });

  const updateLine = (id: string, patch: Partial<Line>) => setLines((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  const rows = useMemo(() => {
    const landed = allocateLanded(
      pending.map((it) => ({ quantity: lines[it.id].quantity, unitCost: lines[it.id].unitCost })),
      freight + otherExpenses - discount,
    );
    return pending.map((item, i) => {
      const line = lines[item.id];
      const newCost = line.quantity > 0 ? averageCost(item.stock_quantity, item.current_cost, line.quantity, landed[i], item.sell_in_bulk) : item.current_cost;
      const price = line.salePrice ?? item.sale_price;
      const currentMargin = margin(item.current_cost, item.sale_price);
      return {
        item,
        line,
        landed: landed[i],
        newCost,
        newMargin: margin(newCost, price),
        currentMargin,
        suggested: item.sale_price > 0 && item.current_cost < item.sale_price ? round2(newCost / (1 - currentMargin / 100)) : null,
      };
    });
  }, [pending, lines, freight, otherExpenses, discount]);

  const receiving = rows.filter((r) => r.line.quantity > 0);
  const itemsTotal = round2(receiving.reduce((s, r) => s + r.line.quantity * r.line.unitCost, 0));
  const total = round2(itemsTotal + freight + otherExpenses - discount);
  const generated = useMemo(() => (total > 0 ? splitInstallments(total, count, firstDue, Number(interval)) : []), [total, count, firstDue, interval]);
  const installments = custom ?? generated;
  const installmentsSum = round2(installments.reduce((s, i) => s + i.amount, 0));
  const mismatch = total > 0 && Math.round(installmentsSum * 100) !== Math.round(total * 100);
  const overPending = rows.find((r) => r.line.quantity > r.item.pending_quantity);

  const errors = [
    receiving.length === 0 && "Informe a quantidade recebida de ao menos um item.",
    overPending && `${overPending.item.product_name}: o pendente é ${overPending.item.pending_quantity}.`,
    total < 0 && "O desconto não pode ser maior que o total da nota.",
    invoiceKey && !/^\d{44}$/.test(invoiceKey) && "A chave da NF-e tem 44 dígitos.",
    mismatch && `A soma das parcelas (${formatCurrency(installmentsSum)}) difere do total (${formatCurrency(total)}).`,
    installments.some((i) => !i.due_date || !(i.amount > 0)) && "Revise as datas e valores das parcelas.",
  ].filter(Boolean) as string[];

  // Mudar o total ou a configuração das parcelas descarta a edição manual.
  const resetCustom = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setCustom(null);
  };

  const onScanned = (code: string) => {
    setScannerOpen(false);
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 44) {
      haptics.warning();
      Alert.alert("Código inválido", "Aponte para o código de barras da chave de acesso no DANFE (44 dígitos).");
      return;
    }
    haptics.success();
    setInvoiceKey(digits);
    // A chave traz série (posições 23-25) e número (26-34) da nota.
    if (!invoiceSeries) setInvoiceSeries(String(Number(digits.slice(22, 25))));
    if (!invoiceNumber) setInvoiceNumber(String(Number(digits.slice(25, 34))));
  };

  const submit = async () => {
    if (errors.length > 0) {
      haptics.warning();
      Alert.alert("Revise o recebimento", errors.map((e) => `• ${e}`).join("\n"));
      return;
    }
    setSubmitting(true);
    try {
      const updated = await ReceivePurchaseOrder(order.id, {
        received_at: receivedAt,
        invoice_number: invoiceNumber.trim() || undefined,
        invoice_series: invoiceSeries.trim() || undefined,
        invoice_key: invoiceKey || undefined,
        freight,
        other_expenses: otherExpenses,
        discount,
        notes: notes.trim() || undefined,
        items: receiving.map((r) => ({
          order_item_id: r.item.id,
          quantity: r.line.quantity,
          unit_cost: r.line.unitCost,
          sale_price: r.line.salePrice !== null && r.line.salePrice !== r.item.sale_price ? r.line.salePrice : undefined,
        })),
        installments: total > 0 ? installments : [],
        bill_category_id: categoryId || undefined,
        payment_method_id: methodId || undefined,
      });
      haptics.success();
      Alert.alert(
        "Recebimento registrado",
        updated.status === "received" ? "Mercadoria recebida! Pedido concluído." : "O restante continua pendente no pedido.",
      );
      router.back();
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao receber", getApiErrorMessage(error, "Não foi possível registrar o recebimento."));
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerClassName="w-full max-w-content self-center gap-three p-three">
        <SectionCard title="O que chegou" icon="cube-outline">
          <ThemedText type="small" themeColor="textSecondary" className="-mt-two text-xs">
            Já vem preenchido com o pendente. Ajuste o que veio diferente.
          </ThemedText>
          {rows.map(({ item, line, landed, newCost, newMargin, currentMargin, suggested }) => (
            <View key={item.id} className={`gap-two rounded-two p-three ${line.quantity > 0 ? "bg-surface" : "bg-surface opacity-60"}`}>
              <View className="flex-row items-start justify-between gap-two">
                <ThemedText type="smallBold" className="flex-1">
                  {catalogLabel(item)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                  falta {item.pending_quantity}
                </ThemedText>
              </View>
              <View className="flex-row items-center gap-two">
                <View className={`w-20 flex-row items-center rounded-two border bg-paper px-two ${line.quantity > item.pending_quantity ? "border-danger" : "border-line"}`}>
                  <TextInput
                    value={String(line.quantity)}
                    onChangeText={(t) => updateLine(item.id, { quantity: Number(t.replace(/\D/g, "").slice(0, 6)) || 0 })}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    accessibilityLabel={`Quantidade recebida de ${item.product_name}`}
                    className="flex-1 py-three text-center text-base font-bold text-ink"
                  />
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                    un
                  </ThemedText>
                </View>
                <View className="flex-1">
                  <MoneyInput value={line.unitCost} onChange={(unitCost) => updateLine(item.id, { unitCost })} />
                </View>
              </View>
              {line.quantity > 0 && (
                <View className="gap-one">
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                    Custo com rateio {unitMoney(landed)} · custo médio {formatCurrency(item.current_cost)} → {formatCurrency(newCost)}
                  </ThemedText>
                  <View className="flex-row items-center justify-between gap-two">
                    <ThemedText type="small" className={`text-xs ${newMargin < currentMargin - 0.05 ? "text-amber-700" : "text-muted"}`}>
                      Margem {formatPercent(currentMargin, 1)} → {formatPercent(newMargin, 1)} (venda {formatCurrency(line.salePrice ?? item.sale_price)})
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        haptics.select();
                        setPriceOpen((p) => ({ ...p, [item.id]: !p[item.id] }));
                      }}
                      hitSlop={6}
                    >
                      <ThemedText type="smallBold" className="text-xs text-brand">
                        {priceOpen[item.id] ? "Fechar" : "Preço"}
                      </ThemedText>
                    </Pressable>
                  </View>
                  {priceOpen[item.id] && (
                    <View className="gap-two">
                      <MoneyInput value={line.salePrice ?? item.sale_price} onChange={(salePrice) => updateLine(item.id, { salePrice })} />
                      {suggested !== null && suggested !== (line.salePrice ?? item.sale_price) && (
                        <Pressable
                          onPress={() => {
                            haptics.select();
                            updateLine(item.id, { salePrice: suggested });
                          }}
                          className="self-start rounded-full bg-brand-soft px-three py-one active:opacity-70"
                        >
                          <ThemedText type="smallBold" className="text-xs text-brand">
                            Manter a margem: {formatCurrency(suggested)}
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Nota fiscal" icon="document-text-outline">
          <View className="flex-row gap-two">
            <View className="flex-1 gap-two">
              <FormLabel label="Número" />
              <FormInput placeholder="000123" value={invoiceNumber} onChangeText={setInvoiceNumber} keyboardType="number-pad" maxLength={20} />
            </View>
            <View className="w-24 gap-two">
              <FormLabel label="Série" />
              <FormInput placeholder="1" value={invoiceSeries} onChangeText={setInvoiceSeries} keyboardType="number-pad" maxLength={5} />
            </View>
          </View>
          <View className="gap-two">
            <FormLabel label="Chave de acesso" />
            <FormInput
              placeholder="44 dígitos"
              value={invoiceKey}
              onChangeText={(t) => setInvoiceKey(t.replace(/\D/g, "").slice(0, 44))}
              keyboardType="number-pad"
              error={invoiceKey && invoiceKey.length !== 44 ? "x" : undefined}
              suffix={
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    setScannerOpen(true);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Ler chave da nota pela câmera"
                >
                  <Ionicons name="barcode-outline" size={22} color="#3c87f7" />
                </Pressable>
              }
            />
            <ThemedText type="small" themeColor="textSecondary" className="text-xs">
              Leia o código de barras do DANFE: número e série são preenchidos sozinhos.
            </ThemedText>
          </View>
          <View className="gap-two">
            <FormLabel label="Data do recebimento" icon="calendar-outline" />
            <DateField value={receivedAt} onChange={setReceivedAt} maximumDate={new Date()} />
          </View>
        </SectionCard>

        <SectionCard title="Valores da nota" icon="calculator-outline">
          {[
            { label: "Frete", value: freight, set: setFreight },
            { label: "Outras despesas", value: otherExpenses, set: setOtherExpenses },
            { label: "Desconto", value: discount, set: setDiscount },
          ].map((f) => (
            <View key={f.label} className="flex-row items-center gap-three">
              <ThemedText type="small" className="w-32">
                {f.label}
              </ThemedText>
              <View className="flex-1">
                <MoneyInput value={f.value} onChange={resetCustom(f.set)} />
              </View>
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            Frete, despesas e desconto entram no custo dos produtos, rateados pelo valor de cada item.
          </ThemedText>
          <View className="flex-row items-center justify-between border-t-hairline border-line pt-two">
            <ThemedText type="small" themeColor="textSecondary">
              Itens {formatCurrency(itemsTotal)}
            </ThemedText>
            <ThemedText className={`font-bold ${total < 0 ? "text-danger" : ""}`}>Total {formatCurrency(total)}</ThemedText>
          </View>
        </SectionCard>

        {total > 0 && (
          <SectionCard title="Contas a pagar" icon="calendar-outline">
            <View className="flex-row items-center justify-between">
              <ThemedText type="small">Parcelas</ThemedText>
              <View className="flex-row items-center rounded-two border border-line bg-paper">
                <Pressable
                  onPress={() => {
                    if (count <= 1) return haptics.warning();
                    haptics.select();
                    resetCustom(setCount)(count - 1);
                  }}
                  className="h-9 w-9 items-center justify-center"
                  accessibilityLabel="Menos parcelas"
                >
                  <Ionicons name="remove" size={18} color="#000000" />
                </Pressable>
                <ThemedText type="smallBold" className="w-8 text-center">
                  {count}
                </ThemedText>
                <Pressable
                  onPress={() => {
                    if (count >= 24) return haptics.warning();
                    haptics.select();
                    resetCustom(setCount)(count + 1);
                  }}
                  className="h-9 w-9 items-center justify-center"
                  accessibilityLabel="Mais parcelas"
                >
                  <Ionicons name="add" size={18} color="#000000" />
                </Pressable>
              </View>
            </View>
            <View className="gap-two">
              <FormLabel label="Primeiro vencimento" />
              <DateField value={firstDue} onChange={resetCustom(setFirstDue)} />
            </View>
            {count > 1 && (
              <Segmented
                options={[
                  { value: "30", label: "Mensal" },
                  { value: "15", label: "15 dias" },
                  { value: "7", label: "Semanal" },
                ]}
                value={interval}
                onChange={resetCustom(setIntervalDays)}
              />
            )}
            <View className="gap-two">
              {installments.map((inst, i) => (
                <View key={i} className="flex-row items-center gap-two">
                  <ThemedText type="smallBold" themeColor="textSecondary" className="w-6 text-xs">
                    {i + 1}ª
                  </ThemedText>
                  <View className="flex-1">
                    <DateField
                      value={inst.due_date}
                      onChange={(due_date) => setCustom(installments.map((x, j) => (j === i ? { ...x, due_date } : x)))}
                    />
                  </View>
                  <View className="w-36">
                    <MoneyInput
                      value={inst.amount}
                      onChange={(amount) => setCustom(installments.map((x, j) => (j === i ? { ...x, amount } : x)))}
                    />
                  </View>
                </View>
              ))}
              {mismatch && <FieldError message={`A soma (${formatCurrency(installmentsSum)}) difere do total (${formatCurrency(total)}).`} />}
            </View>
            {(categories.data?.length ?? 0) > 0 && (
              <View className="gap-two">
                <FormLabel label="Categoria" />
                <OptionChips
                  options={[{ value: "", label: "Nenhuma" }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </View>
            )}
            {(methods.data?.length ?? 0) > 0 && (
              <View className="gap-two">
                <FormLabel label="Forma de pagamento" />
                <OptionChips
                  options={[{ value: "", label: "A definir" }, ...(methods.data ?? []).map((m) => ({ value: m.id, label: m.name }))]}
                  value={methodId}
                  onChange={setMethodId}
                />
              </View>
            )}
          </SectionCard>
        )}

        <View className="gap-two rounded-three bg-paper p-three">
          <FormLabel label="Observação" icon="chatbubble-outline" />
          <FormInput placeholder="Opcional" value={notes} onChangeText={setNotes} multiline maxLength={500} />
        </View>
      </KeyboardAwareScrollView>

      <View
        className="gap-three bg-paper px-four pt-three"
        style={{ paddingBottom: insets.bottom + Spacing.three, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#E0E1E6" }}
      >
        <View className="flex-row items-end justify-between">
          <View>
            <ThemedText type="small" themeColor="textSecondary" className="text-[11px] tracking-widest">
              TOTAL DA NOTA
            </ThemedText>
            <ThemedText className="text-2xl font-bold">{formatCurrency(Math.max(total, 0))}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {receiving.reduce((s, r) => s + r.line.quantity, 0)} un. · {total > 0 ? `${installments.length}x` : "sem conta"}
          </ThemedText>
        </View>
        <GradientButton
          label={submitting ? "Registrando..." : "Confirmar recebimento"}
          icon="checkmark-circle-outline"
          colors={SUCCESS_GRADIENT}
          disabled={submitting}
          onPress={submit}
          className={submitting || errors.length > 0 ? "opacity-60" : ""}
        />
      </View>

      <BarcodeScanner visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={onScanned} />
    </View>
  );
}

/** Entrada da mercadoria: estoque, custo médio e contas a pagar. */
export default function ReceivePurchaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refresh } = useResource((signal) => GetPurchaseOrder(id, signal), [id], {
    errorMessage: "Não foi possível carregar o pedido.",
  });

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Receber mercadoria"
        subtitle={data ? `Pedido nº ${data.number} · ${data.vendor_name}` : "Carregando..."}
        leading={{
          type: "back",
          onPress: () =>
            Alert.alert("Sair sem receber?", "O que foi preenchido será perdido.", [
              { text: "Continuar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: router.back },
            ]),
        }}
      />
      {loading ? (
        <View className="p-three">
          <CardListSkeleton count={3} />
        </View>
      ) : error || !data ? (
        <EmptyState icon="cube-outline" message={error ?? "Pedido não encontrado."} error onRetry={refresh} />
      ) : !data.can_receive ? (
        <EmptyState icon="checkmark-done-outline" message="Este pedido não tem itens pendentes para receber." />
      ) : (
        <ReceiveForm order={data} />
      )}
    </View>
  );
}
