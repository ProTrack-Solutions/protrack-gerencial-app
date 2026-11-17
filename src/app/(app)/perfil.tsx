import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/login/gradient-button";
import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { SectionCard } from "@/components/sale/section-card";
import { initials } from "@/components/settings/settings-items";
import { ThemedText } from "@/components/themed-text";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Gradients } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { getApiErrorMessage } from "@/service/api.service";
import { UpdateOwnProfile } from "@/service/user.service";
import { haptics } from "@/utils/haptics";
import { isValidEmail } from "@/utils/masks";

const MODULE_LABELS: Record<string, string> = {
  financial: "Financeiro",
  sales: "Vendas",
  customers: "Clientes",
  inventory: "Estoque",
  purchases: "Compras",
  reports: "Relatórios",
  whatsapp: "WhatsApp",
};

type Errors = Partial<Record<"name" | "email" | "username", string>>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const changed = name.trim() !== (user?.name ?? "") || email.trim().toLowerCase() !== (user?.email ?? "") || username.trim() !== (user?.username ?? "");
  const admin = user?.role === "ADMIN";
  const modules = admin ? Object.keys(MODULE_LABELS) : (user?.modules ?? []);

  const save = async () => {
    const next: Errors = {};
    if (name.trim().length < 3) next.name = "Informe o nome completo.";
    if (!isValidEmail(email.trim())) next.email = "E-mail inválido.";
    if (username.trim().length < 3) next.username = "Mínimo de 3 caracteres.";
    setErrors(next);
    if (Object.keys(next).length > 0) return haptics.warning();

    setSaving(true);
    try {
      await UpdateOwnProfile({ name: name.trim(), email: email.trim().toLowerCase(), username: username.trim() });
      await refreshUser().catch(() => undefined);
      haptics.success();
      Alert.alert("Perfil atualizado", "Suas informações foram salvas.", [{ text: "OK", onPress: router.back }]);
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(error, "Não foi possível atualizar o perfil."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Meu perfil" subtitle="Suas informações de acesso." leading={{ type: "back", onPress: router.back }} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-content self-center gap-three p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="items-center gap-two rounded-four p-four">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-white">
            <ThemedText className="text-2xl font-bold text-brand">{initials(user?.name)}</ThemedText>
          </View>
          <ThemedText className="text-lg font-bold text-white">{user?.name}</ThemedText>
          <View className="rounded-full bg-white/20 px-three py-half">
            <ThemedText type="smallBold" className="text-xs text-white">
              {admin ? "Administrador" : user?.department_name || "Colaborador"}
            </ThemedText>
          </View>
        </LinearGradient>

        <SectionCard title="Acesso liberado" icon="key-outline">
          <View className="flex-row flex-wrap gap-two">
            {modules.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nenhum módulo liberado para o seu departamento.
              </ThemedText>
            ) : (
              modules.map((m) => (
                <View key={m} className="rounded-full border border-brand-line bg-brand-soft px-three py-one">
                  <ThemedText type="smallBold" className="text-xs text-brand">
                    {MODULE_LABELS[m] ?? m}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
          {!admin && (
            <ThemedText type="small" themeColor="textSecondary" className="text-xs">
              Os módulos vêm do departamento. Peça ao administrador para mudar.
            </ThemedText>
          )}
        </SectionCard>

        <SectionCard title="Informações pessoais" icon="person-outline">
          <View className="gap-two">
            <FormLabel label="Nome completo" required />
            <FormInput value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" autoComplete="name" error={errors.name} />
            <FieldError message={errors.name} />
          </View>
          <View className="gap-two">
            <FormLabel label="E-mail" required />
            <FormInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              autoComplete="email"
              error={errors.email}
            />
            <FieldError message={errors.email} />
          </View>
          <View className="gap-two">
            <FormLabel label="Usuário" required />
            <FormInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} textContentType="username" error={errors.username} />
            <FieldError message={errors.username} />
          </View>
          <GradientButton
            label={saving ? "Salvando..." : "Salvar alterações"}
            icon="checkmark-circle-outline"
            colors={Gradients.primary}
            disabled={saving || !changed}
            onPress={save}
            className={saving || !changed ? "opacity-50" : ""}
          />
        </SectionCard>
      </KeyboardAwareScrollView>
    </View>
  );
}
