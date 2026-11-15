import { Pressable, ScrollView, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { haptics } from "@/utils/haptics";

type Option<T extends string> = { value: T; label: string; count?: number };

type FilterChipsProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Chips roláveis na horizontal para filtrar uma lista (mesmo visual de Contas a Receber). */
export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-three"
      contentContainerClassName="gap-two px-three"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-row items-center gap-one rounded-full border px-four py-two active:opacity-70 ${
              selected ? "border-blue-600 bg-blue-600" : "border-line bg-paper"
            }`}
          >
            <ThemedText type="smallBold" className={selected ? "text-white" : "text-ink"}>
              {option.label}
            </ThemedText>
            {option.count !== undefined && option.count > 0 && (
              <View className={`rounded-full px-two ${selected ? "bg-white/25" : "bg-surface"}`}>
                <ThemedText type="smallBold" className={`text-xs ${selected ? "text-white" : "text-muted"}`}>
                  {option.count}
                </ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Duas ou três opções lado a lado, ocupando a largura toda. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View className="flex-row rounded-full bg-surface p-half">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-full py-two ${selected ? "bg-paper" : "active:opacity-70"}`}
          >
            <ThemedText type="smallBold" className={`text-xs ${selected ? "text-ink" : "text-muted"}`}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
