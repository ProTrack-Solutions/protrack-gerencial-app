import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/login/gradient-button";
import { FormInput, FormLabel } from "@/components/product/form-field";
import { SectionCard } from "@/components/sale/section-card";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor, Gradients } from "@/constants/theme";
import { useAppLock } from "@/contexts/app-lock-context";
import { useAuth } from "@/contexts/auth-context";
import { getApiErrorMessage } from "@/service/api.service";
import { UpdatePassword } from "@/service/user.service";
import { haptics } from "@/utils/haptics";

// Mesmas regras que a API valida na troca de senha.
const RULES = [
  { label: "Pelo menos 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Uma letra", test: (p: string) => /[a-zA-Z]/.test(p) },
  { label: "Um número", test: (p: string) => /\d/.test(p) },
  { label: "Um caractere especial (!@#$...)", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

function PasswordInput({ value, onChangeText, placeholder, error }: { value: string; onChangeText: (v: string) => void; placeholder: string; error?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <FormInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      error={error ? "x" : undefined}
      suffix={
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={visible ? "Esconder senha" : "Mostrar senha"}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color="#566176" />
        </Pressable>
      }
    />
  );
}

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const lock = useAppLock();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const rulesOk = RULES.every((r) => r.test(password));
  const matches = confirm.length > 0 && confirm === password;
  const canSave = current.length > 0 && rulesOk && matches && !saving;

  const changePassword = async () => {
    if (!canSave) return haptics.warning();
    setSaving(true);
    try {
      await UpdatePassword({ current_password: current, password });
      haptics.success();
      setCurrent("");
      setPassword("");
      setConfirm("");
      Alert.alert("Senha alterada", "Use a nova senha no próximo acesso.");
    } catch (error) {
      haptics.error();
      Alert.alert("Erro ao alterar senha", getApiErrorMessage(error, "Confira a senha atual e tente de novo."));
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async (value: boolean) => {
    setToggling(true);
    try {
      const changed = await lock.setEnabled(value);
      if (!changed && value) Alert.alert("Não ativado", "A biometria não foi confirmada.");
    } catch {
      Alert.alert("Erro", "Não foi possível alterar o desbloqueio por biometria.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Segurança" subtitle="Senha e proteção do app." leading={{ type: "back", onPress: router.back }} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-content self-center gap-three p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <SectionCard title="Desbloqueio por biometria" icon="finger-print-outline">
          <View className="flex-row items-center gap-three">
            <ThemedText type="small" themeColor="textSecondary" className="flex-1">
              {lock.support.available
                ? `Pede ${lock.support.label} ao abrir o app e ao voltar depois de 1 minuto fora dele.`
                : "Cadastre a biometria ou o bloqueio de tela nas configurações do aparelho para usar este recurso."}
            </ThemedText>
            <Switch
              value={lock.enabled}
              onValueChange={toggleLock}
              disabled={toggling || (!lock.support.available && !lock.enabled)}
              trackColor={{ true: BrandColor, false: "#DEE5ED" }}
              thumbColor="#ffffff"
              accessibilityLabel="Desbloqueio por biometria"
            />
          </View>
        </SectionCard>

        <SectionCard title="Alterar senha" icon="lock-closed-outline">
          <View className="gap-two">
            <FormLabel label="Senha atual" required />
            <PasswordInput value={current} onChangeText={setCurrent} placeholder="Digite sua senha atual" />
          </View>
          <View className="gap-two">
            <FormLabel label="Nova senha" required />
            <PasswordInput value={password} onChangeText={setPassword} placeholder="Crie uma senha forte" />
            <View className="gap-one">
              {RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <View key={rule.label} className="flex-row items-center gap-two">
                    <Ionicons name={ok ? "checkmark-circle" : "ellipse-outline"} size={14} color={ok ? "#2F855A" : "#8A94A6"} />
                    <ThemedText type="small" className={`text-xs ${ok ? "text-success" : "text-muted"}`}>
                      {rule.label}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
          <View className="gap-two">
            <FormLabel label="Confirmar nova senha" required />
            <PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Repita a nova senha" error={confirm.length > 0 && !matches} />
            {confirm.length > 0 && !matches && (
              <ThemedText type="small" className="text-xs text-danger">
                As senhas não coincidem.
              </ThemedText>
            )}
          </View>
          <GradientButton
            label={saving ? "Alterando..." : "Alterar senha"}
            icon="key-outline"
            colors={Gradients.primary}
            disabled={!canSave}
            onPress={changePassword}
            className={canSave ? "" : "opacity-50"}
          />
        </SectionCard>

        <Pressable
          onPress={() => {
            haptics.warning();
            Alert.alert("Sair da conta?", "Você precisará entrar novamente.", [
              { text: "Cancelar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: signOut },
            ]);
          }}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-two rounded-three border border-rose-200 bg-paper py-three active:bg-red-50"
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <ThemedText type="smallBold" className="text-danger">
            Sair da conta neste aparelho
          </ThemedText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}
