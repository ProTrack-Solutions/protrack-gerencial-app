import { useEffect, useState } from "react";
import { View } from "react-native";

import { FormInput, FormLabel } from "@/components/product/form-field";
import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";

const DANGER = ["#DC2626", "#F87171"] as const;

type ReasonSheetProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  placeholder?: string;
  onClose: () => void;
  /** Rejeita para manter a folha aberta (ex: erro da API). */
  onConfirm: (reason: string) => Promise<void>;
};

/** Pede o motivo antes de uma ação irreversível (cancelar, encerrar, estornar). */
export function ReasonSheet({ visible, title, description, confirmLabel, placeholder, onClose, onConfirm }: ReasonSheetProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setReason("");
  }, [visible]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={title}
      icon="alert-circle-outline"
      colors={DANGER}
      onClose={onClose}
      submit={{
        label: submitting ? "Aguarde..." : confirmLabel,
        onPress: submit,
        loading: submitting,
        disabled: reason.trim().length < 3,
      }}
    >
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
      <View className="gap-two">
        <FormLabel label="Motivo" required />
        <FormInput placeholder={placeholder ?? "Explique o motivo"} value={reason} onChangeText={setReason} multiline maxLength={500} autoFocus />
      </View>
    </FormSheet>
  );
}
