import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { BrandColor } from "@/constants/theme";
import { haptics } from "@/utils/haptics";

type RecordRowProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Cor do ícone (ou da bolinha, para categorias). */
  color?: string;
  active: boolean;
  onPress?: () => void;
  /** Sem `onToggle`, o switch não aparece (usuário sem permissão). */
  onToggle?: (value: boolean) => void;
  toggling?: boolean;
  /** Conteúdo extra abaixo do título (chips, botões de contato). */
  children?: ReactNode;
};

/** Linha de cadastro: ícone, nome, descrição e switch de ativo/inativo. */
export function RecordRow({ title, subtitle, icon = "ellipse", color = BrandColor, active, onPress, onToggle, toggling, children }: RecordRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className={`gap-two rounded-three border border-line bg-paper p-three active:bg-surface ${active ? "" : "opacity-60"}`}
    >
      <View className="flex-row items-center gap-three">
        <View className="h-10 w-10 items-center justify-center rounded-two" style={{ backgroundColor: `${color}1A` }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View className="flex-1 gap-half">
          <ThemedText type="smallBold" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={2}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {onToggle && (
          <Switch
            value={active}
            disabled={toggling}
            onValueChange={(value) => {
              haptics.select();
              onToggle(value);
            }}
            trackColor={{ true: BrandColor, false: "#DEE5ED" }}
            thumbColor="#ffffff"
            accessibilityLabel={`${title} ${active ? "ativo" : "inativo"}`}
          />
        )}
      </View>
      {children}
    </Pressable>
  );
}

/** Botão flutuante "+ Novo" das telas de cadastro. */
export function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      className="absolute right-four flex-row items-center gap-two rounded-full bg-brand px-four py-three active:opacity-85"
      style={{
        bottom: insets.bottom + 24,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Ionicons name="add" size={20} color="#ffffff" />
      <ThemedText type="smallBold" className="text-white">
        {label}
      </ThemedText>
    </Pressable>
  );
}
