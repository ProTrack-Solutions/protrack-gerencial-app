import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type BiometricSupport = {
  /** Aparelho tem biometria ou bloqueio de tela cadastrado. */
  available: boolean;
  /** Dá para usar a entrada estilo banco (biometria ou senha do aparelho). */
  canStoreCredentials: boolean;
  /** "Face ID", "reconhecimento facial", "impressão digital" ou "bloqueio de tela". */
  label: string;
  face: boolean;
};

export const NO_BIOMETRIC_SUPPORT: BiometricSupport = { available: false, canStoreCredentials: false, label: "biometria", face: false };

export async function detectBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") return NO_BIOMETRIC_SUPPORT;
  const [hardware, level, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const biometricEnrolled = hardware && level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  const face = biometricEnrolled && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const fingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  // Sem biometria, o PIN/padrão do aparelho também protege a entrada.
  const usable = level > LocalAuthentication.SecurityLevel.NONE;
  let label = "bloqueio de tela";
  if (biometricEnrolled) {
    if (Platform.OS === "ios") label = face ? "Face ID" : "Touch ID";
    else label = face && !fingerprint ? "reconhecimento facial" : fingerprint && !face ? "impressão digital" : "biometria";
  }
  return { available: usable, canStoreCredentials: usable, label, face };
}

/** Pede a biometria do aparelho (cai no PIN/padrão se preciso). */
export async function confirmBiometric(promptMessage: string) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancelar",
    disableDeviceFallback: false,
    // Aceita o desbloqueio facial comum do Android (classe 2), não só digital.
    biometricsSecurityLevel: "weak",
  });
  return result.success;
}

/* -------------------------------------------------------------------------- */
/* Login por biometria                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Credenciais criptografadas no cofre do sistema (Keychain/Keystore), só deste
 * aparelho. O app só lê depois que a biometria confirma.
 */
const CREDENTIALS_KEY = "protrack_biometric_credentials_v2";
/** Versão anterior (cofre com requireAuthentication), removida ao desativar. */
const LEGACY_CREDENTIALS = { key: "protrack_biometric_credentials", service: "protrack_biometric_login" };
/** Quem está cadastrado (sem senha), para mostrar "Olá, Fulano" na tela de login. */
const PROFILE_KEY = "protrack_biometric_profile";
/** E-mails que pediram para não perguntar mais. */
const DECLINED_KEY = "protrack_biometric_declined_v2";

export type BiometricProfile = { email: string; name: string };
type Credentials = { email: string; password: string };

const VAULT_OPTIONS: SecureStore.SecureStoreOptions = {
  // Não vai para backup nem para outro aparelho.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getBiometricProfile(): Promise<BiometricProfile | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as BiometricProfile) : null;
  } catch {
    return null;
  }
}

/** Confirma a biometria e guarda as credenciais. Retorna `false` se o usuário cancelou. */
export async function enableBiometricLogin(email: string, password: string, name: string, prompt: string) {
  if (!(await confirmBiometric(prompt))) return false;
  const credentials: Credentials = { email, password };
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials), VAULT_OPTIONS);
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify({ email, name } satisfies BiometricProfile));
  await clearDeclined(email);
  return true;
}

/** Atualiza a senha guardada (ex: depois de trocar a senha no app), sem pedir biometria. */
export async function updateBiometricPassword(email: string, password: string) {
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password } satisfies Credentials), VAULT_OPTIONS);
}

export async function disableBiometricLogin() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(CREDENTIALS_KEY, VAULT_OPTIONS),
    SecureStore.deleteItemAsync(PROFILE_KEY),
    SecureStore.deleteItemAsync(LEGACY_CREDENTIALS.key, { keychainService: LEGACY_CREDENTIALS.service }),
  ]);
}

export class BiometricInvalidatedError extends Error {}

/** Logo depois de "Sair", a tela de login não abre a biometria sozinha. */
let signedOutManually = false;
export const markSignedOut = () => {
  signedOutManually = true;
};
export const consumeSignedOut = () => {
  const value = signedOutManually;
  signedOutManually = false;
  return value;
};

/**
 * Pede a biometria e devolve as credenciais. `null` quando o usuário cancela.
 * Se as credenciais sumiram do cofre, limpa tudo e lança `BiometricInvalidatedError`.
 */
export async function readBiometricCredentials(prompt: string): Promise<Credentials | null> {
  if (!(await confirmBiometric(prompt))) return null;
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, VAULT_OPTIONS);
  } catch {
    raw = null;
  }
  if (!raw) {
    await disableBiometricLogin();
    throw new BiometricInvalidatedError();
  }
  return JSON.parse(raw) as Credentials;
}

async function readDeclined(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(DECLINED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function hasDeclinedBiometricLogin(email: string) {
  return (await readDeclined()).includes(email.toLowerCase());
}

export async function declineBiometricLogin(email: string) {
  const list = new Set(await readDeclined());
  list.add(email.toLowerCase());
  await SecureStore.setItemAsync(DECLINED_KEY, JSON.stringify([...list]));
}

async function clearDeclined(email: string) {
  const list = (await readDeclined()).filter((e) => e !== email.toLowerCase());
  await SecureStore.setItemAsync(DECLINED_KEY, JSON.stringify(list));
}
