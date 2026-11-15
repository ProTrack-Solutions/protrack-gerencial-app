import { FormInput } from "@/components/product/form-field";
import type { TextInputProps } from "react-native";

type MoneyInputProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  value: number;
  onChange: (value: number) => void;
  error?: string;
};

/** 1234.5 -> "1.234,50" */
export function formatMoneyInput(value: number) {
  const [integer, decimals] = Math.abs(value).toFixed(2).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimals}`;
}

/**
 * Campo de valor em reais que digita como maquininha: cada dígito entra pela
 * direita (1 -> 0,01 -> 0,12 -> 1,23). Não precisa digitar vírgula, e o
 * teclado numérico do celular não tem vírgula em todos os aparelhos.
 */
export function MoneyInput({ value, onChange, error, ...props }: MoneyInputProps) {
  return (
    <FormInput
      prefix="R$"
      keyboardType="number-pad"
      inputMode="numeric"
      value={formatMoneyInput(value)}
      onChangeText={(text) => {
        const cents = Number(text.replace(/\D/g, "").slice(-11) || "0");
        onChange(cents / 100);
      }}
      selectTextOnFocus={false}
      error={error}
      {...props}
    />
  );
}
