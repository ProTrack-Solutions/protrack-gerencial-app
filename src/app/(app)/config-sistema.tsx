import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { SectionCard } from "@/components/sale/section-card";
import { RecordRow } from "@/components/settings/record-row";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSheet } from "@/components/ui/form-sheet";
import { RowListSkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor } from "@/constants/theme";
import { useRecordList } from "@/hooks/use-record-list";
import { useResource } from "@/hooks/use-resource";
import type { CashRegisterRecord, CompanySettingKey } from "@/interfaces/settings.interface";
import { getApiErrorMessage } from "@/service/api.service";
import {
  CreateCashRegister,
  ListCashRegisterRecords,
  ListCompanySettings,
  SaveCompanySetting,
  UpdateCashRegister,
} from "@/service/settings.service";
import { formatTime } from "@/utils/dates";
import { haptics } from "@/utils/haptics";

// Mesmos padrões da API e do web quando a configuração nunca foi gravada.
const DEFAULT_LOW_STOCK = 5;
const MEDIUM_STOCK_FACTOR = 2;
const DEFAULT_RETURN_WINDOW_DAYS = 30;

/** Número com - e + (segurar o botão anda 5 passos). */
function NumberStepper({ value, min, max, step = 1, suffix, onChange }: { value: number; min: number; max: number; step?: number; suffix: string; onChange: (v: number) => void }) {
  const change = (delta: number) => {
    const next = Math.min(Math.max(value + delta, min), max);
    if (next === value) return haptics.warning();
    haptics.select();
    onChange(next);
  };
  return (
    <View className="flex-row items-center gap-three">
      <Pressable
        onPress={() => change(-step)}
        onLongPress={() => change(-step * 5)}
        accessibilityRole="button"
        accessibilityLabel="Diminuir"
        className="h-11 w-11 items-center justify-center rounded-full border border-line bg-paper active:bg-surface"
      >
        <Ionicons name="remove" size={20} color="#000000" />
      </Pressable>
      <View className="min-w-24 items-center">
        <ThemedText className="text-2xl font-bold">{value}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-xs">
          {suffix}
        </ThemedText>
      </View>
      <Pressable
        onPress={() => change(step)}
        onLongPress={() => change(step * 5)}
        accessibilityRole="button"
        accessibilityLabel="Aumentar"
        className="h-11 w-11 items-center justify-center rounded-full border border-line bg-paper active:bg-surface"
      >
        <Ionicons name="add" size={20} color="#000000" />
      </Pressable>
    </View>
  );
}

function SaveButton({ dirty, saving, onPress }: { dirty: boolean; saving: boolean; onPress: () => void }) {
  if (!dirty) return null;
  return (
    <Pressable onPress={onPress} disabled={saving} accessibilityRole="button" className="items-center rounded-two bg-brand py-three active:opacity-80">
      <ThemedText type="smallBold" className="text-white">
        {saving ? "Salvando..." : "Salvar"}
      </ThemedText>
    </Pressable>
  );
}

function RegisterSheet({ register, visible, onClose, onSaved }: { register: CashRegisterRecord | null; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(register?.name ?? "");
    setError(undefined);
  }, [visible, register]);

  const save = async () => {
    if (name.trim().length < 2) {
      setError("Informe o nome do caixa.");
      return haptics.warning();
    }
    setSaving(true);
    try {
      if (register) await UpdateCashRegister(register.id, { name: name.trim(), active: register.active });
      else await CreateCashRegister(name.trim());
      haptics.success();
      onSaved();
      onClose();
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(e, "Não foi possível salvar o caixa."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={register ? "Renomear caixa" : "Novo caixa"}
      subtitle="Cada caixa físico (balcão, loja 2...) tem o próprio turno."
      icon="calculator-outline"
      onClose={onClose}
      submit={{ label: saving ? "Salvando..." : "Salvar", icon: "checkmark-circle-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Nome" required />
        <FormInput value={name} onChangeText={setName} placeholder="Ex.: Caixa 2" autoFocus error={error} />
        <FieldError message={error} />
      </View>
    </FormSheet>
  );
}

/** Regras da empresa (ADMIN): caixa obrigatório, caixas, estoque baixo e prazo de troca. */
export default function SystemSettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useResource((signal) => ListCompanySettings(signal), [], { errorMessage: "Não foi possível carregar as configurações." });
  const registers = useRecordList(ListCashRegisterRecords, { errorMessage: "Não foi possível carregar os caixas.", searchText: (r) => r.name });
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingRegister, setEditingRegister] = useState<CashRegisterRecord | null>(null);
  const [saving, setSaving] = useState<CompanySettingKey | null>(null);

  const get = (key: CompanySettingKey) => settings.data?.find((s) => s.key === key)?.value;
  const requireOpen = get("require_open_cash_register") === true;
  const savedLowRaw = Number(get("low_stock"));
  const savedLow = Number.isInteger(savedLowRaw) && savedLowRaw > 0 ? savedLowRaw : DEFAULT_LOW_STOCK;
  const savedDaysRaw = Number(get("return_window_days"));
  const savedDays = get("return_window_days") !== undefined && Number.isInteger(savedDaysRaw) && savedDaysRaw >= 0 ? savedDaysRaw : DEFAULT_RETURN_WINDOW_DAYS;

  const [lowStock, setLowStock] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const low = lowStock ?? savedLow;
  const windowDays = days ?? savedDays;

  const save = async (key: CompanySettingKey, value: string | number | boolean, success: string) => {
    setSaving(key);
    try {
      await SaveCompanySetting(key, value);
      haptics.success();
      settings.setData((current) => {
        const list = (current ?? []).filter((s) => s.key !== key);
        return [...list, { key, value }];
      });
      if (key === "low_stock") setLowStock(null);
      if (key === "return_window_days") setDays(null);
      Alert.alert("Salvo", success);
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(e, "Não foi possível salvar a configuração."));
    } finally {
      setSaving(null);
    }
  };

  const toggleRegister = (r: CashRegisterRecord, active: boolean) => {
    const run = () => registers.toggle(r, { active }, () => UpdateCashRegister(r.id, { name: r.name, active }));
    if (active) return run();
    haptics.warning();
    Alert.alert(`Desativar ${r.name}?`, "Os aparelhos que usam este caixa vão pedir para escolher outro.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Desativar", style: "destructive", onPress: run },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Sistema" subtitle="Regras de caixa, estoque e trocas." leading={{ type: "back", onPress: router.back }} />
      <ScrollView
        contentContainerClassName="w-full max-w-content self-center gap-three p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={settings.refreshing || registers.refreshing}
            onRefresh={() => {
              settings.refresh();
              registers.refresh();
            }}
            tintColor={BrandColor}
          />
        }
      >
        {settings.error ? (
          <EmptyState icon="settings-outline" message={settings.error} error onRetry={settings.refresh} />
        ) : (
          <>
            <SectionCard title="Vendas com caixa aberto" icon="lock-closed-outline">
              <View className="flex-row items-center gap-three">
                <ThemedText type="small" themeColor="textSecondary" className="flex-1">
                  {requireOpen
                    ? "Vendas e recebimentos só podem ser feitos com o caixa aberto."
                    : "Dá para vender e receber parcelas mesmo com o caixa fechado."}
                </ThemedText>
                <Switch
                  value={requireOpen}
                  disabled={settings.loading || saving === "require_open_cash_register"}
                  onValueChange={(v) => {
                    haptics.select();
                    save("require_open_cash_register", v, v ? "Agora é preciso abrir o caixa para vender." : "Vendas liberadas mesmo com o caixa fechado.");
                  }}
                  trackColor={{ true: BrandColor, false: "#DEE5ED" }}
                  thumbColor="#ffffff"
                  accessibilityLabel="Exigir caixa aberto"
                />
              </View>
            </SectionCard>

            <SectionCard title="Caixas da loja" icon="calculator-outline">
              {registers.loading ? (
                <RowListSkeleton count={2} />
              ) : registers.error ? (
                <FieldError message={registers.error} />
              ) : (
                registers.items.map((r) => (
                  <RecordRow
                    key={r.id}
                    title={r.name}
                    subtitle={r.open_session ? `Aberto por ${r.open_session.opened_by_name} às ${formatTime(r.open_session.opened_at)}` : r.active ? "Fechado" : "Desativado"}
                    icon="desktop-outline"
                    color={r.open_session ? "#2F855A" : BrandColor}
                    active={r.active}
                    toggling={registers.togglingId === r.id}
                    onPress={() => {
                      setEditingRegister(r);
                      setRegisterOpen(true);
                    }}
                    onToggle={(v) => toggleRegister(r, v)}
                  />
                ))
              )}
              <Pressable
                onPress={() => {
                  haptics.tap();
                  setEditingRegister(null);
                  setRegisterOpen(true);
                }}
                accessibilityRole="button"
                className="items-center rounded-two border border-dashed border-brand-line bg-brand-soft py-three active:opacity-70"
              >
                <ThemedText type="smallBold" className="text-brand">
                  + Novo caixa
                </ThemedText>
              </Pressable>
            </SectionCard>

            <SectionCard title="Estoque baixo" icon="cube-outline">
              <ThemedText type="small" themeColor="textSecondary">
                Produtos com menos unidades que isso aparecem em vermelho no estoque e nos alertas.
              </ThemedText>
              <View className="items-center">
                <NumberStepper value={low} min={1} max={9999} suffix="unidades" onChange={setLowStock} />
              </View>
              <View className="flex-row gap-two">
                {[
                  { label: "Baixo", range: `0 a ${low - 1}`, box: "bg-rose-50 border-rose-300", text: "text-rose-700" },
                  { label: "Médio", range: `${low} a ${low * MEDIUM_STOCK_FACTOR - 1}`, box: "bg-amber-50 border-amber-300", text: "text-amber-700" },
                  { label: "Normal", range: `${low * MEDIUM_STOCK_FACTOR}+`, box: "bg-emerald-50 border-emerald-300", text: "text-emerald-700" },
                ].map((band) => (
                  <View key={band.label} className={`flex-1 items-center gap-half rounded-two border p-two ${band.box}`}>
                    <ThemedText type="smallBold" className={`text-xs ${band.text}`}>
                      {band.label}
                    </ThemedText>
                    <ThemedText type="small" className={`text-xs ${band.text}`}>
                      {band.range}
                    </ThemedText>
                  </View>
                ))}
              </View>
              <SaveButton dirty={low !== savedLow} saving={saving === "low_stock"} onPress={() => save("low_stock", low, "Limite de estoque baixo atualizado.")} />
            </SectionCard>

            <SectionCard title="Prazo de troca" icon="return-down-back-outline">
              <ThemedText type="small" themeColor="textSecondary">
                Dias depois da venda em que o cliente pode trocar ou devolver. Fora do prazo, só um administrador registra. Zero = sem prazo.
              </ThemedText>
              <View className="items-center">
                <NumberStepper value={windowDays} min={0} max={365} suffix={windowDays === 0 ? "sem prazo" : windowDays === 1 ? "dia" : "dias"} onChange={setDays} />
              </View>
              <View className="flex-row flex-wrap justify-center gap-two">
                {[7, 15, 30, 90].map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => {
                      haptics.select();
                      setDays(d);
                    }}
                    className={`rounded-full border px-three py-one ${windowDays === d ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}
                  >
                    <ThemedText type="smallBold" className={`text-xs ${windowDays === d ? "text-brand" : ""}`}>
                      {d} dias
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <SaveButton
                dirty={windowDays !== savedDays}
                saving={saving === "return_window_days"}
                onPress={() => save("return_window_days", windowDays, "Prazo de troca atualizado.")}
              />
            </SectionCard>

            <ThemedText type="small" themeColor="textSecondary" className="text-center text-xs">
              A integração com o WhatsApp é configurada no ProTrack web.
            </ThemedText>
          </>
        )}
      </ScrollView>

      <RegisterSheet register={editingRegister} visible={registerOpen} onClose={() => setRegisterOpen(false)} onSaved={registers.reload} />
    </View>
  );
}
