import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { BrandColor, Spacing } from "@/constants/theme";
import { formatIsoDate, fromIsoDate, toIsoDate } from "@/utils/dates";
import { haptics } from "@/utils/haptics";

type DateFieldProps = {
  /** "2026-10-27" ou vazio. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  /** Mostra o "x" para limpar a data. */
  clearable?: boolean;
};

/**
 * Campo de data que abre o calendário nativo: o diálogo do Android ou o
 * calendário do iOS numa folha. No web cai num campo de texto do navegador.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Selecione a data",
  minimumDate,
  maximumDate,
  error,
  clearable,
}: DateFieldProps) {
  const insets = useSafeAreaInsets();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const current = value ? fromIsoDate(value) : new Date();

  const open = () => {
    haptics.tap();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        minimumDate,
        maximumDate,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(toIsoDate(date));
        },
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  };

  if (Platform.OS === "web") {
    return (
      <View
        className={`flex-row items-center rounded-two border bg-field px-three ${error ? "border-danger" : "border-line"}`}
      >
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, padding: 14, border: "none", background: "transparent", fontSize: 16 }}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={value ? `Data ${formatIsoDate(value)}` : placeholder}
        className={`flex-row items-center gap-two rounded-two border bg-field px-three py-three active:opacity-70 ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <Ionicons name="calendar-outline" size={18} color={value ? BrandColor : "#8B8D98"} />
        <ThemedText className={`flex-1 text-base ${value ? "text-ink" : "text-placeholder"}`}>
          {value ? formatIsoDate(value) : placeholder}
        </ThemedText>
        {clearable && value ? (
          <Pressable
            onPress={() => onChange("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Limpar data"
          >
            <Ionicons name="close-circle" size={18} color="#8B8D98" />
          </Pressable>
        ) : null}
      </Pressable>

      {Platform.OS === "ios" && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable className="flex-1 bg-black/40" onPress={() => setIosOpen(false)} />
          <View className="rounded-t-four bg-paper px-four pt-three" style={{ paddingBottom: insets.bottom + Spacing.three }}>
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setIosOpen(false)} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  onChange(toIsoDate(draft));
                  setIosOpen(false);
                }}
                hitSlop={8}
              >
                <ThemedText type="smallBold" className="text-brand">
                  Confirmar
                </ThemedText>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              locale="pt-BR"
              accentColor={BrandColor}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={(_, date) => date && setDraft(date)}
            />
          </View>
        </Modal>
      )}
    </>
  );
}
