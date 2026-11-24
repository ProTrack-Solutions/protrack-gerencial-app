import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * O login por biometria foi removido. Quem tinha ativado ainda tem e-mail e
 * senha no cofre do aparelho: apaga tudo ao abrir o app (é idempotente).
 */
const KEYS: { key: string; options?: SecureStore.SecureStoreOptions }[] = [
  { key: "protrack_biometric_credentials_v2", options: { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } },
  { key: "protrack_biometric_credentials", options: { keychainService: "protrack_biometric_login" } },
  { key: "protrack_biometric_profile" },
  { key: "protrack_biometric_declined_v2" },
  { key: "protrack_biometric_lock" },
];

export async function clearBiometricData() {
  if (Platform.OS === "web") return;
  await Promise.allSettled(KEYS.map(({ key, options }) => SecureStore.deleteItemAsync(key, options)));
}
