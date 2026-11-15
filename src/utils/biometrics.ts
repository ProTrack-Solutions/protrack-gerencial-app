import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type BiometricSupport = {
  /** Aparelho tem biometria (ou bloqueio de tela) cadastrada. */
  available: boolean;
  /** Dá para guardar a senha protegida por biometria forte (login estilo banco). */
  canStoreCredentials: boolean;
  /** "Face ID", "reconhecimento facial" ou "impressão digital". */
  label: string;
  face: boolean;
};

export const NO_BIOMETRIC_SUPPORT: BiometricSupport = { available: false, canStoreCredentials: false, label: "biometria", face: false };

export async function detectBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") return NO_BIOMETRIC_SUPPORT;
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const fingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  let canStore = false;
  try {
    canStore = hardware && enrolled && SecureStore.canUseBiometricAuthentication();
  } catch {
    canStore = false;
  }
  return {
    available: hardware && enrolled,
    canStoreCredentials: canStore,
    // No Android o rosto costuma ser biometria "fraca": a digital é o que libera o cofre.
    label: face && (Platform.OS === "ios" || !fingerprint) ? (Platform.OS === "ios" ? "Face ID" : "reconhecimento facial") : "impressão digital",
    face,
  };
}

/* -------------------------------------------------------------------------- */
/* Login por biometria                                                        */
/* -------------------------------------------------------------------------- */

/** Credenciais no cofre do aparelho, liberadas só pela biometria. */
const CREDENTIALS_KEY = "protrack_biometric_credentials";
/** Serviço próprio: o item com `requireAuthentication` precisa de uma chave nova (ver docs do SecureStore). */
const CREDENTIALS_SERVICE = "protrack_biometric_login";
/** Quem está cadastrado (sem senha), para mostrar "Olá, Fulano" na tela de login. */
const PROFILE_KEY = "protrack_biometric_profile";
/** E-mails que já recusaram a oferta, para não perguntar a cada login. */
const DECLINED_KEY = "protrack_biometric_declined";

export type BiometricProfile = { email: string; name: string };
type Credentials = { email: string; password: string };

const vaultOptions = (prompt: string): SecureStore.SecureStoreOptions => ({
  keychainService: CREDENTIALS_SERVICE,
  requireAuthentication: true,
  authenticationPrompt: prompt,
  // Não vai para backup nem para outro aparelho; some se o bloqueio de tela for removido.
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
});

export async function getBiometricProfile(): Promise<BiometricProfile | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as BiometricProfile) : null;
  } catch {
    return null;
  }
}

/** Guarda as credenciais protegidas pela biometria (no Android já pede a digital aqui). */
export async function enableBiometricLogin(email: string, password: string, name: string, prompt: string) {
  const credentials: Credentials = { email, password };
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials), vaultOptions(prompt));
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify({ email, name } satisfies BiometricProfile));
  await clearDeclined(email);
}

export async function disableBiometricLogin() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(CREDENTIALS_KEY, { keychainService: CREDENTIALS_SERVICE }),
    SecureStore.deleteItemAsync(PROFILE_KEY),
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
 * Se a biometria do aparelho mudou (digital nova), o cofre é invalidado pelo
 * sistema: limpa tudo e lança `BiometricInvalidatedError`.
 */
export async function readBiometricCredentials(prompt: string): Promise<Credentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, vaultOptions(prompt));
    if (!raw) {
      await disableBiometricLogin();
      throw new BiometricInvalidatedError();
    }
    return JSON.parse(raw) as Credentials;
  } catch (error) {
    if (error instanceof BiometricInvalidatedError) throw error;
    const message = String((error as Error)?.message ?? error).toLowerCase();
    if (message.includes("invalidated") || message.includes("permanently") || message.includes("decrypt")) {
      await disableBiometricLogin();
      throw new BiometricInvalidatedError();
    }
    // Cancelado ou biometria não reconhecida.
    return null;
  }
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
