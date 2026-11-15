import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, View } from "react-native";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { RecordListScreen } from "@/components/settings/record-list-screen";
import { RecordRow } from "@/components/settings/record-row";
import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { useRecordList } from "@/hooks/use-record-list";
import type { SaveVendorParams, VendorRecord } from "@/interfaces/settings.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { LookupCep } from "@/service/customer.service";
import { CreateVendor, ListVendors, ToggleVendor, UpdateVendor } from "@/service/settings.service";
import { haptics } from "@/utils/haptics";
import { isValidEmail, maskCep, maskCpf, maskPhone } from "@/utils/masks";

const EMPTY: SaveVendorParams = {
  name: "",
  tax_id: "",
  email: "",
  phone: "",
  postal_code: "",
  address_line_1: "",
  number: "",
  address_line_2: "",
  neighborhood: "",
  city: "",
  state: "",
  country: "Brasil",
};

/** CPF (11 dígitos) ou CNPJ (14). */
function maskDocument(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return maskCpf(d);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function ContactButtons({ vendor }: { vendor: VendorRecord }) {
  const phone = vendor.phone.replace(/\D/g, "");
  const buttons = [
    phone && { icon: "call-outline" as const, label: "Ligar", color: "#3c87f7", url: `tel:${phone}` },
    phone && { icon: "logo-whatsapp" as const, label: "WhatsApp", color: "#047857", url: `https://wa.me/55${phone}` },
    vendor.email && { icon: "mail-outline" as const, label: "E-mail", color: "#7C3AED", url: `mailto:${vendor.email}` },
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; url: string }[];
  if (buttons.length === 0) return null;

  return (
    <View className="flex-row gap-two">
      {buttons.map((b) => (
        <Pressable
          key={b.label}
          onPress={() => {
            haptics.tap();
            Linking.openURL(b.url).catch(() => Alert.alert("Não foi possível abrir", `Nenhum app disponível para ${b.label.toLowerCase()}.`));
          }}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-one rounded-two border border-line py-two active:bg-surface"
        >
          <Ionicons name={b.icon} size={16} color={b.color} />
          <ThemedText type="smallBold" className="text-xs">
            {b.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function VendorSheet({ vendor, visible, onClose, onSaved }: { vendor: VendorRecord | null; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<SaveVendorParams>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof SaveVendorParams, string>>>({});
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    if (vendor) {
      const { id: _id, is_active: _active, ...rest } = vendor;
      setForm({ ...EMPTY, ...rest, tax_id: maskDocument(rest.tax_id ?? ""), phone: maskPhone(rest.phone ?? ""), postal_code: maskCep(rest.postal_code ?? "") });
    } else setForm(EMPTY);
  }, [visible, vendor]);

  const set = (key: keyof SaveVendorParams) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // CEP completo preenche o endereço pelo ViaCEP.
  const onCep = async (value: string) => {
    const masked = maskCep(value);
    set("postal_code")(masked);
    if (masked.replace(/\D/g, "").length !== 8) return;
    setLoadingCep(true);
    try {
      const address = await LookupCep(masked);
      if (!address) return setErrors((e) => ({ ...e, postal_code: "CEP não encontrado." }));
      haptics.select();
      setForm((f) => ({
        ...f,
        address_line_1: address.street || f.address_line_1,
        neighborhood: address.neighborhood || f.neighborhood,
        city: address.city || f.city,
        state: address.state || f.state,
      }));
    } catch {
      // Sem internet: preenche à mão.
    } finally {
      setLoadingCep(false);
    }
  };

  const save = async () => {
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = "Informe o nome do fornecedor.";
    if (form.email.trim() && !isValidEmail(form.email.trim())) next.email = "E-mail inválido.";
    setErrors(next);
    if (Object.keys(next).length > 0) return haptics.warning();

    const payload: SaveVendorParams = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      tax_id: form.tax_id.replace(/\D/g, ""),
      phone: form.phone.replace(/\D/g, ""),
      postal_code: form.postal_code.replace(/\D/g, ""),
    };
    setSaving(true);
    try {
      if (vendor) await UpdateVendor(vendor.id, payload);
      else await CreateVendor(payload);
      haptics.success();
      onSaved();
      onClose();
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(error, "Não foi possível salvar o fornecedor."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={vendor ? "Editar fornecedor" : "Novo fornecedor"}
      subtitle="O e-mail é usado para enviar os pedidos de compra."
      icon="business-outline"
      onClose={onClose}
      submit={{ label: saving ? "Salvando..." : "Salvar", icon: "checkmark-circle-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Nome / razão social" required />
        <FormInput value={form.name} onChangeText={set("name")} autoCapitalize="words" error={errors.name} />
        <FieldError message={errors.name} />
      </View>
      <View className="gap-two">
        <FormLabel label="CNPJ ou CPF" />
        <FormInput value={form.tax_id} onChangeText={(v) => set("tax_id")(maskDocument(v))} keyboardType="number-pad" />
      </View>
      <View className="gap-two">
        <FormLabel label="E-mail" icon="mail-outline" />
        <FormInput value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <FieldError message={errors.email} />
      </View>
      <View className="gap-two">
        <FormLabel label="Telefone / WhatsApp" icon="call-outline" />
        <FormInput value={form.phone} onChangeText={(v) => set("phone")(maskPhone(v))} keyboardType="phone-pad" />
      </View>
      <View className="gap-two">
        <FormLabel label="CEP" icon="location-outline" />
        <FormInput
          value={form.postal_code}
          onChangeText={onCep}
          keyboardType="number-pad"
          placeholder="00000-000"
          error={errors.postal_code}
          suffix={loadingCep ? <ActivityIndicator size="small" /> : undefined}
        />
        <FieldError message={errors.postal_code} />
      </View>
      <View className="flex-row gap-two">
        <View className="flex-1 gap-two">
          <FormLabel label="Rua" />
          <FormInput value={form.address_line_1} onChangeText={set("address_line_1")} />
        </View>
        <View className="w-24 gap-two">
          <FormLabel label="Nº" />
          <FormInput value={form.number} onChangeText={set("number")} />
        </View>
      </View>
      <View className="gap-two">
        <FormLabel label="Complemento" />
        <FormInput value={form.address_line_2} onChangeText={set("address_line_2")} />
      </View>
      <View className="gap-two">
        <FormLabel label="Bairro" />
        <FormInput value={form.neighborhood} onChangeText={set("neighborhood")} />
      </View>
      <View className="flex-row gap-two">
        <View className="flex-1 gap-two">
          <FormLabel label="Cidade" />
          <FormInput value={form.city} onChangeText={set("city")} />
        </View>
        <View className="w-20 gap-two">
          <FormLabel label="UF" />
          <FormInput value={form.state} onChangeText={(v) => set("state")(v.toUpperCase().slice(0, 2))} autoCapitalize="characters" />
        </View>
      </View>
    </FormSheet>
  );
}

export default function VendorsScreen() {
  const list = useRecordList(ListVendors, {
    errorMessage: "Não foi possível carregar os fornecedores.",
    searchText: (v) => `${v.name} ${v.tax_id} ${v.email} ${v.city}`,
  });
  const [editing, setEditing] = useState<VendorRecord | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <RecordListScreen
      title="Fornecedores"
      subtitle="De quem você compra mercadoria."
      searchPlaceholder="Nome, CNPJ, e-mail ou cidade"
      emptyIcon="business-outline"
      emptyMessage="Nenhum fornecedor cadastrado."
      noun={["fornecedor", "fornecedores"]}
      list={list}
      keyExtractor={(v) => v.id}
      addLabel="Novo fornecedor"
      onAdd={() => {
        setEditing(null);
        setOpen(true);
      }}
      renderItem={(v) => (
        <RecordRow
          title={v.name}
          subtitle={[maskDocument(v.tax_id ?? ""), v.city && `${v.city}${v.state ? `/${v.state}` : ""}`].filter(Boolean).join(" · ") || "Sem documento"}
          icon="business-outline"
          active={v.is_active}
          toggling={list.togglingId === v.id}
          onPress={() => {
            setEditing(v);
            setOpen(true);
          }}
          onToggle={(value) => list.toggle(v, { is_active: value }, () => ToggleVendor(v.id, value))}
        >
          <ContactButtons vendor={v} />
        </RecordRow>
      )}
    >
      <VendorSheet vendor={editing} visible={open} onClose={() => setOpen(false)} onSaved={list.reload} />
    </RecordListScreen>
  );
}
