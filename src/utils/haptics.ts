import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Vibração curta para confirmar ações. No web não há vibração: tudo vira no-op.
const enabled = Platform.OS !== "web";

const run = (fn: () => Promise<void>) => {
  if (!enabled) return;
  fn().catch(() => {
    // Aparelho sem motor de vibração ou com a vibração desligada.
  });
};

export const haptics = {
  /** Toque leve: selecionar um chip, trocar uma aba. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Toque de botão: abrir um formulário, aumentar uma quantidade. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Ação concluída: venda, baixa, caixa aberto. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Atenção: validação que impede salvar, diferença no fechamento. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Falha na API. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
