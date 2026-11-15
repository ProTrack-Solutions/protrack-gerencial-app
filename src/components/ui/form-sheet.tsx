import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/login/gradient-button";
import { ThemedText } from "@/components/themed-text";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Gradients, Spacing } from "@/constants/theme";

type FormSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Gradiente do cabeçalho e do botão principal. */
  colors?: readonly [string, string, ...string[]];
  onClose: () => void;
  children: ReactNode;
  /** Botão principal do rodapé. Sem ele, o rodapé não aparece (folha só de leitura). */
  submit?: {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
  /** Conteúdo enquanto os dados da folha carregam. */
  loading?: boolean;
};

/**
 * Folha que sobe de baixo com cabeçalho em gradiente, conteúdo rolável que
 * acompanha o teclado e rodapé Cancelar/Confirmar. Mesmo visual da baixa de
 * recebimento (PaymentSheet).
 */
export function FormSheet({
  visible,
  title,
  subtitle,
  icon,
  colors = Gradients.primary,
  onClose,
  children,
  submit,
  loading,
}: FormSheetProps) {
  const insets = useSafeAreaInsets();
  const busy = submit?.loading ?? false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={busy ? undefined : onClose}
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={busy ? undefined : onClose}
        accessibilityLabel="Fechar"
      />
      <View className="max-h-[92%] overflow-hidden rounded-t-four bg-paper">
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="flex-row items-center gap-three px-four py-four"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Ionicons name={icon} size={20} color="#ffffff" />
          </View>
          <View className="flex-1">
            <ThemedText className="text-lg font-bold text-white" numberOfLines={1}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" className="text-xs text-white/85" numberOfLines={2}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            className="h-9 w-9 items-center justify-center rounded-two bg-white/20 active:opacity-70"
          >
            <Ionicons name="close" size={20} color="#ffffff" />
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View className="items-center py-six">
            <ActivityIndicator />
          </View>
        ) : (
          <KeyboardAwareScrollView
            bottomOffset={24}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-four p-four"
            contentContainerStyle={submit ? undefined : { paddingBottom: insets.bottom + Spacing.four }}
          >
            {children}
          </KeyboardAwareScrollView>
        )}

        {submit && (
          <View
            className="flex-row gap-three border-t-hairline border-line px-four pt-three"
            style={{ paddingBottom: insets.bottom + Spacing.three }}
          >
            <Pressable
              onPress={onClose}
              disabled={busy}
              className="items-center justify-center rounded-two border border-line bg-paper px-four active:bg-surface"
              accessibilityRole="button"
            >
              <ThemedText type="smallBold">Cancelar</ThemedText>
            </Pressable>
            <GradientButton
              label={submit.label}
              icon={submit.icon}
              colors={colors}
              disabled={busy || submit.disabled}
              onPress={submit.onPress}
              className={`flex-1 ${busy || submit.disabled ? "opacity-60" : ""}`}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}
