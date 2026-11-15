import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BILL_STATUS, ORDER_STATUS, unitMoney } from "@/components/purchases/format";
import { ReceiveProgress } from "@/components/purchases/order-card";
import { catalogLabel } from "@/components/purchases/pickers";
import { ReasonSheet } from "@/components/purchases/reason-sheet";
import { SectionCard } from "@/components/sale/section-card";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { CardListSkeleton, SummarySkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { StatusPill } from "@/components/ui/status-pill";
import { BrandColor } from "@/constants/theme";
import { useFocusReload } from "@/hooks/use-focus-reload";
import { useResource } from "@/hooks/use-resource";
import type { PurchaseOrderDetail, PurchaseReceipt } from "@/interfaces/purchases.interface";
import { getApiErrorMessage } from "@/service/api.service";
import {
  CancelPurchaseOrder,
  ClosePurchaseOrder,
  EmailPurchaseOrder,
  GetPurchaseOrder,
  ReversePurchaseReceipt,
  SendPurchaseOrder,
} from "@/service/purchases.service";
import { formatDate, formatDateTime } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { sharePdf } from "@/utils/share";

type ReasonAction = { kind: "close" | "cancel" } | { kind: "reverse"; receipt: PurchaseReceipt };

/** PDF do pedido para mandar ao fornecedor pelo WhatsApp, mesmo sem e-mail cadastrado. */
function shareOrder(order: PurchaseOrderDetail) {
  return sharePdf({
    title: `Pedido de compra nº ${order.number}`,
    subtitle: `${order.vendor_name} · emitido em ${formatDate(order.created_at)}${order.expected_date ? ` · entrega prevista ${formatDate(order.expected_date)}` : ""}`,
    highlights: [
      { label: "Itens", value: String(order.items.length) },
      { label: "Quantidade", value: String(order.quantity) },
      { label: "Total", value: formatCurrency(order.total) },
    ],
    sections: [
      {
        title: "Produtos",
        table: {
          columns: [{ label: "Produto" }, { label: "Código" }, { label: "Qtd.", align: "right" }, { label: "Custo un.", align: "right" }, { label: "Total", align: "right" }],
          rows: order.items.map((it) => [catalogLabel(it), it.barcode, it.quantity, unitMoney(it.unit_cost), formatCurrency(it.total)]),
        },
      },
      ...(order.notes ? [{ title: "Observação", lines: [{ label: order.notes, value: "" }] }] : []),
    ],
  });
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <View className="flex-1 gap-half">
      <ThemedText type="smallBold" themeColor="textSecondary" className="text-[10px] tracking-wider">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" className={className} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

function ReceiptCard({ receipt: r, onReverse }: { receipt: PurchaseReceipt; onReverse?: () => void }) {
  const reversed = r.status === "reversed";
  return (
    <View className={`gap-two rounded-two p-three ${reversed ? "bg-surface opacity-70" : "bg-emerald-50"}`}>
      <View className="flex-row items-start gap-two">
        <View className="flex-1 gap-half">
          <ThemedText type="smallBold">
            {formatDate(r.received_at)}
            {r.invoice_number ? ` · NF ${r.invoice_number}${r.invoice_series ? `/${r.invoice_series}` : ""}` : ""}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            Por {r.created_by_name} · {r.items.reduce((s, i) => s + i.quantity, 0)} un.
          </ThemedText>
        </View>
        {reversed ? <StatusPill label="Estornado" tone="danger" /> : <ThemedText className="font-bold">{formatCurrency(r.total)}</ThemedText>}
      </View>
      {(r.freight > 0 || r.other_expenses > 0 || r.discount > 0) && (
        <ThemedText type="small" themeColor="textSecondary" className="text-xs">
          Itens {formatCurrency(r.items_total)}
          {r.freight > 0 ? ` · frete ${formatCurrency(r.freight)}` : ""}
          {r.other_expenses > 0 ? ` · despesas ${formatCurrency(r.other_expenses)}` : ""}
          {r.discount > 0 ? ` · desconto ${formatCurrency(r.discount)}` : ""}
        </ThemedText>
      )}
      {r.bills.length > 0 && (
        <View className="gap-one">
          {r.bills.map((b) => (
            <View key={b.id} className="flex-row items-center justify-between gap-two">
              <ThemedText type="small" className="flex-1 text-xs" numberOfLines={1}>
                Vence {formatDate(b.due_date)} · {formatCurrency(b.amount)}
              </ThemedText>
              <StatusPill label={BILL_STATUS[b.status]?.label ?? b.status} tone={BILL_STATUS[b.status]?.tone} />
            </View>
          ))}
        </View>
      )}
      {reversed && r.reversal_reason ? (
        <ThemedText type="small" className="text-xs text-rose-700">
          Estornado por {r.reversed_by_name}: “{r.reversal_reason}”
        </ThemedText>
      ) : null}
      {!reversed && onReverse && (
        <Pressable onPress={onReverse} accessibilityRole="button" className="self-start py-one active:opacity-60">
          <ThemedText type="smallBold" className="text-xs text-danger">
            Estornar recebimento
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

export default function PurchaseOrderScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, setData, loading, refreshing, error, refresh, reload } = useResource(
    (signal) => GetPurchaseOrder(id, signal),
    [id],
    { errorMessage: "Não foi possível carregar o pedido." },
  );
  useFocusReload(reload);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);

  const run = async (key: string, action: () => Promise<PurchaseOrderDetail>, success: string) => {
    setBusy(key);
    try {
      setData(await action());
      haptics.success();
      Alert.alert("Pronto", success);
    } catch (e) {
      haptics.error();
      Alert.alert("Erro", getApiErrorMessage(e, "Não foi possível concluir a ação."));
    } finally {
      setBusy(null);
    }
  };

  if (loading || !order) {
    return (
      <View className="flex-1 bg-surface">
        <ScreenHeader title="Pedido de compra" subtitle="Carregando..." leading={{ type: "back", onPress: router.back }} />
        {error ? (
          <EmptyState icon="cube-outline" message={error} error onRetry={refresh} />
        ) : (
          <View className="gap-three p-three">
            <SummarySkeleton />
            <CardListSkeleton count={3} />
          </View>
        )}
      </View>
    );
  }

  const status = ORDER_STATUS[order.status];
  const pendingTotal = Math.max(order.total - order.received_total, 0);

  const sendOrder = () => {
    haptics.tap();
    Alert.alert("Marcar como enviado?", `O pedido nº ${order.number} passa a aguardar a entrega.`, [
      { text: "Voltar", style: "cancel" },
      ...(order.vendor_email
        ? [
            {
              text: "Enviar e mandar e-mail",
              onPress: () =>
                run(
                  "send",
                  async () => {
                    await SendPurchaseOrder(order.id);
                    return EmailPurchaseOrder(order.id, "sent");
                  },
                  `Pedido enviado e e-mail para ${order.vendor_email}.`,
                ),
            },
          ]
        : []),
      { text: "Só marcar", onPress: () => run("send", () => SendPurchaseOrder(order.id), "Pedido marcado como enviado.") },
    ]);
  };

  const resendEmail = () => {
    haptics.tap();
    Alert.alert("Reenviar e-mail?", `O PDF do pedido vai para ${order.vendor_email}.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Reenviar", onPress: () => run("email", () => EmailPurchaseOrder(order.id, "resend"), `E-mail enviado para ${order.vendor_email}.`) },
    ]);
  };

  const actions: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; show: boolean; danger?: boolean }[] = [
    { key: "edit", label: "Editar", icon: "create-outline", onPress: () => router.push({ pathname: "/novo-pedido-compra", params: { id: order.id } }), show: order.can_edit },
    { key: "send", label: "Enviar", icon: "send-outline", onPress: sendOrder, show: order.can_send },
    { key: "share", label: "PDF", icon: "share-outline", onPress: () => shareOrder(order), show: true },
    { key: "email", label: "E-mail", icon: "mail-outline", onPress: resendEmail, show: order.can_email && Boolean(order.vendor_email) },
    { key: "close", label: "Encerrar", icon: "checkmark-done-outline", onPress: () => setReasonAction({ kind: "close" }), show: order.can_close },
    { key: "cancel", label: "Cancelar", icon: "close-circle-outline", onPress: () => setReasonAction({ kind: "cancel" }), show: order.can_cancel, danger: true },
  ];

  const reasonCopy =
    reasonAction?.kind === "close"
      ? {
          title: `Encerrar pedido nº ${order.number}?`,
          description: "O que ainda não chegou deixa de ser esperado. O que já foi recebido continua no estoque e no financeiro.",
          confirm: "Encerrar pedido",
          placeholder: "Ex.: fornecedor não tem o restante",
        }
      : reasonAction?.kind === "cancel"
        ? {
            title: `Cancelar pedido nº ${order.number}?`,
            description: "O pedido deixa de valer. Nada foi recebido, então estoque e financeiro não mudam.",
            confirm: "Cancelar pedido",
            placeholder: "Ex.: comprado de outro fornecedor",
          }
        : {
            title: "Estornar recebimento?",
            description: "As quantidades saem do estoque, o custo volta ao anterior e as contas a pagar em aberto são canceladas.",
            confirm: "Estornar",
            placeholder: "Ex.: nota lançada em duplicidade",
          };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title={`Pedido nº ${order.number}`}
        subtitle={`Criado em ${formatDateTime(order.created_at)} por ${order.created_by_name}`}
        leading={{ type: "back", onPress: router.back }}
      />

      <ScrollView
        contentContainerClassName="w-full max-w-content self-center gap-three p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + (order.can_receive ? 110 : 24) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BrandColor} />}
      >
        <View className="gap-three rounded-three bg-paper p-three">
          <View className="flex-row items-start gap-two">
            <View className="flex-1 gap-half">
              <ThemedText className="text-lg font-bold">{order.vendor_name}</ThemedText>
              {order.vendor_email ? (
                <Pressable onPress={() => Linking.openURL(`mailto:${order.vendor_email}`)} hitSlop={4}>
                  <ThemedText type="small" className="text-brand">
                    {order.vendor_email}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            <StatusPill label={status.label} tone={status.tone} />
          </View>
          <View className="flex-row gap-two">
            <Stat label="TOTAL" value={formatCurrency(order.total)} />
            <Stat label="RECEBIDO" value={formatCurrency(order.received_total)} className="text-success" />
            <Stat label={order.status === "closed" ? "DESCARTADO" : "FALTA"} value={formatCurrency(pendingTotal)} />
          </View>
          <View className="gap-one">
            <ReceiveProgress received={order.received_quantity} total={order.quantity} />
            <ThemedText type="small" themeColor="textSecondary" className="text-xs">
              {order.received_quantity} de {order.quantity} unidades recebidas
              {order.expected_date ? ` · previsão ${formatDate(order.expected_date)}` : ""}
            </ThemedText>
          </View>
          {order.closed_at && (
            <ThemedText type="small" className="rounded-two bg-surface p-two text-xs">
              {order.status === "canceled" ? "Cancelado" : "Encerrado"} em {formatDateTime(order.closed_at)}
              {order.close_reason ? `: “${order.close_reason}”` : ""}
            </ThemedText>
          )}
          {order.notes ? (
            <ThemedText type="small" themeColor="textSecondary">
              {order.notes}
            </ThemedText>
          ) : null}
        </View>

        <View className="flex-row flex-wrap gap-two">
          {actions
            .filter((a) => a.show)
            .map((a) => (
              <Pressable
                key={a.key}
                onPress={() => {
                  haptics.tap();
                  a.onPress();
                }}
                disabled={busy !== null}
                accessibilityRole="button"
                className={`grow basis-[30%] items-center gap-one rounded-three border bg-paper py-three active:bg-surface ${
                  a.danger ? "border-rose-200" : "border-line"
                }`}
              >
                {busy === a.key ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Ionicons name={a.icon} size={20} color={a.danger ? "#DC2626" : BrandColor} />
                )}
                <ThemedText type="smallBold" className={`text-xs ${a.danger ? "text-danger" : ""}`}>
                  {a.label}
                </ThemedText>
              </Pressable>
            ))}
        </View>

        <SectionCard title="Produtos" icon="cube-outline">
          {order.items.map((it) => (
            <View key={it.id} className="gap-one rounded-two bg-surface p-three">
              <View className="flex-row items-start justify-between gap-two">
                <ThemedText type="smallBold" className="flex-1">
                  {catalogLabel(it)}
                </ThemedText>
                <ThemedText type="smallBold">{formatCurrency(it.total)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                {it.quantity} × {unitMoney(it.unit_cost)}
                {it.received_quantity > 0 ? ` · recebido ${it.received_quantity}` : ""}
                {it.pending_quantity > 0 && order.can_receive ? ` · falta ${it.pending_quantity}` : ""}
              </ThemedText>
              <ReceiveProgress received={it.received_quantity} total={it.quantity} />
            </View>
          ))}
        </SectionCard>

        {order.receipts.length > 0 && (
          <SectionCard title="Recebimentos" icon="checkmark-done-outline">
            {order.receipts.map((r) => (
              <ReceiptCard key={r.id} receipt={r} onReverse={() => setReasonAction({ kind: "reverse", receipt: r })} />
            ))}
          </SectionCard>
        )}

        {order.emails?.length > 0 && (
          <SectionCard title="E-mails enviados" icon="mail-outline">
            {order.emails.map((e) => (
              <ThemedText key={`${e.created_at}-${e.kind}`} type="small" themeColor="textSecondary" className="text-xs">
                {formatDateTime(e.created_at)} · {e.kind === "sent" ? "pedido" : e.kind === "updated" ? "alteração" : "reenvio"} para {e.recipient} por{" "}
                {e.sent_by_name}
              </ThemedText>
            ))}
          </SectionCard>
        )}
      </ScrollView>

      {order.can_receive && (
        <View className="absolute inset-x-0 bottom-0 bg-surface px-three pt-two" style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push({ pathname: "/receber-compra", params: { id: order.id } });
            }}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-two rounded-three bg-emerald-600 py-four active:opacity-85"
          >
            <Ionicons name="archive-outline" size={20} color="#ffffff" />
            <ThemedText className="font-bold text-white">Receber mercadoria</ThemedText>
          </Pressable>
        </View>
      )}

      <ReasonSheet
        visible={reasonAction !== null}
        title={reasonCopy.title}
        description={reasonCopy.description}
        confirmLabel={reasonCopy.confirm}
        placeholder={reasonCopy.placeholder}
        onClose={() => setReasonAction(null)}
        onConfirm={async (reason) => {
          const action = reasonAction;
          if (!action) return;
          try {
            const updated =
              action.kind === "reverse"
                ? await ReversePurchaseReceipt(action.receipt.id, reason)
                : action.kind === "close"
                  ? await ClosePurchaseOrder(order.id, reason)
                  : await CancelPurchaseOrder(order.id, reason);
            setData(updated);
            haptics.success();
            setReasonAction(null);
          } catch (e) {
            haptics.error();
            Alert.alert("Erro", getApiErrorMessage(e, "Não foi possível concluir a ação."));
          }
        }}
      />
    </View>
  );
}
