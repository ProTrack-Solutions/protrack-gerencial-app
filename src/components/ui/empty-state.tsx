import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  /** Mostra a mensagem em vermelho e o ícone de sem conexão. */
  error?: boolean;
  onRetry?: () => void;
};

/** Lista vazia ou erro ao carregar, centralizado. */
export function EmptyState({ icon, message, error, onRetry }: EmptyStateProps) {
  return (
    <View className="items-center gap-two py-five">
      <Ionicons name={error ? "cloud-offline-outline" : icon} size={28} color="#566176" />
      <ThemedText
        type="small"
        themeColor="textSecondary"
        className={`text-center ${error ? "text-red-700" : ""}`}
      >
        {message}
      </ThemedText>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="mt-one rounded-full bg-brand px-four py-two active:opacity-80"
        >
          <ThemedText type="smallBold" className="text-white">
            Tentar novamente
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}
