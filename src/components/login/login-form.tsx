import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, Text, View } from "react-native";

import { BiometricLoginPanel } from "@/components/login/biometric-login-panel";
import { GradientButton } from "@/components/login/gradient-button";
import { TextField } from "@/components/login/text-field";
import { ThemedText } from "@/components/themed-text";
import { BiometricLoginError, useAuth } from "@/contexts/auth-context";
import { getLoginErrorMessage } from "@/service/auth.service";
import { consumeSignedOut } from "@/utils/biometrics";
import { haptics } from "@/utils/haptics";

type LoginFormValues = {
  email: string;
  password: string;
};

/**
 * Credentials form. On success the session switches to authenticated and the
 * root navigator moves to the protected `(app)` routes.
 */
export function LoginForm() {
  const { signIn, biometric } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Com biometria cadastrada, abre direto no "Olá, Fulano"; a senha fica a um toque.
  const [usePassword, setUsePassword] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const autoPrompted = useRef(false);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
  });

  const profile = biometric.profile;
  const showBiometric = Boolean(profile) && !usePassword;

  const enterWithBiometrics = async () => {
    setBiometricError(null);
    setBiometricLoading(true);
    try {
      const entered = await biometric.signIn();
      if (entered) haptics.success();
    } catch (error) {
      haptics.error();
      if (error instanceof BiometricLoginError) {
        setBiometricError(error.message);
        if (profile) setValue("email", profile.email);
        setUsePassword(true);
      } else {
        setBiometricError(getLoginErrorMessage(error));
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  // Como no app do banco: a biometria já abre sozinha ao entrar na tela.
  useEffect(() => {
    if (!profile || autoPrompted.current) return;
    autoPrompted.current = true;
    if (consumeSignedOut()) return;
    enterWithBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const onSubmit = async ({ email, password }: LoginFormValues) => {
    setSubmitError(null);
    try {
      const me = await signIn(email.trim(), password);
      // A pergunta "Ativar entrada por biometria?" aparece já dentro do app.
      await biometric.offerAfterLogin(email.trim(), password, me.name);
    } catch (error) {
      setSubmitError(getLoginErrorMessage(error));
    }
  };

  if (showBiometric && profile) {
    return (
      <BiometricLoginPanel
        profile={profile}
        support={biometric.support}
        loading={biometricLoading}
        error={biometricError}
        onBiometric={enterWithBiometrics}
        onUsePassword={() => {
          setValue("email", profile.email);
          setBiometricError(null);
          setUsePassword(true);
        }}
        onSwitchAccount={() =>
          Alert.alert("Usar outra conta?", `A entrada por ${biometric.support.label} de ${profile.name} será removida deste aparelho.`, [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Remover",
              style: "destructive",
              onPress: async () => {
                await biometric.disable();
                setValue("email", "");
                setUsePassword(true);
              },
            },
          ])
        }
      />
    );
  }

  return (
    <View className="gap-four">
      <View className="gap-one">
        <ThemedText type="subtitle" className="text-2xl leading-[30px]">
          Entrar na sua conta
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Informe suas credenciais para acessar o painel.
        </ThemedText>
      </View>

      <Controller
        control={control}
        name="email"
        rules={{
          required: "E-mail é obrigatório",
          pattern: { value: /^\S+@\S+\.\S+$/, message: "Informe um e-mail válido" },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="E-mail ou usuário"
            icon="mail-outline"
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
          />
        )}
      />
      {errors.email && (
        <Text style={{ color: "red" }}>{errors.email.message}</Text>
      )}

      <Controller
        control={control}
        name="password"
        rules={{
          required: "Senha é obrigatória",
          minLength: { value: 6, message: "Mínimo 6 caracteres" },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Senha"
            icon="lock-closed-outline"
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            trailingIcon={showPassword ? "eye-off-outline" : "eye-outline"}
            onTrailingIconPress={() => setShowPassword((v) => !v)}
            trailingIconAccessibilityLabel={
              showPassword ? "Ocultar senha" : "Mostrar senha"
            }
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
          />
        )}
      />
      {errors.password && (
        <Text style={{ color: "red" }}>{errors.password.message}</Text>
      )}

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-two">
          <View className="h-[18px] w-[18px] items-center justify-center rounded-half bg-ink">
            <Ionicons name="checkmark" size={12} color="#ffffff" />
          </View>
          <ThemedText type="small">Lembrar de mim</ThemedText>
        </View>
        <ThemedText type="linkPrimary">Esqueceu a senha?</ThemedText>
      </View>

      {!submitError && biometricError && (
        <View className="flex-row items-center gap-two rounded-two bg-[#FEF3C7] px-three py-two">
          <Ionicons name="finger-print" size={18} color="#B45309" />
          <ThemedText type="small" className="flex-1" style={{ color: "#92400E" }}>
            {biometricError}
          </ThemedText>
        </View>
      )}

      {submitError && (
        <View className="flex-row items-center gap-two rounded-two bg-[#FEECEC] px-three py-two">
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <ThemedText type="small" className="flex-1" style={{ color: "#B91C1C" }}>
            {submitError}
          </ThemedText>
        </View>
      )}

      <GradientButton
        label={isSubmitting ? "Entrando..." : "Entrar"}
        icon="log-in-outline"
        disabled={isSubmitting}
        className={isSubmitting ? "opacity-70" : undefined}
        onPress={handleSubmit(onSubmit)}
      />

      {profile && (
        <Pressable
          onPress={() => {
            setUsePassword(false);
            enterWithBiometrics();
          }}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-two py-one"
        >
          <Ionicons name={biometric.support.face ? "scan-outline" : "finger-print"} size={18} color="#7C4FE0" />
          <ThemedText type="linkPrimary">Entrar com {biometric.support.label}</ThemedText>
        </Pressable>
      )}

      <View className="flex-row flex-wrap justify-center items-center">
        <ThemedText type="small" themeColor="textSecondary">
          Ainda não tem uma conta?{" "}
        </ThemedText>
        <Pressable>
          <ThemedText type="linkPrimary">Criar conta</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
