import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Caixa físico em que este aparelho trabalha. Fica salvo no aparelho e vai em
// toda requisição no header `CashRegisterId`: é por ele que a API sabe em qual
// turno a venda e o recebimento entram (mesma regra do ProTrack web).

const STORAGE_KEY = "protrack_cash_register_id";

type Listener = () => void;
const listeners = new Set<Listener>();
let current: string | null = null;

const storage = {
  get: () =>
    Platform.OS === "web"
      ? Promise.resolve(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null)
      : SecureStore.getItemAsync(STORAGE_KEY),
  set: (value: string | null) => {
    if (Platform.OS === "web") {
      if (value) globalThis.localStorage?.setItem(STORAGE_KEY, value);
      else globalThis.localStorage?.removeItem(STORAGE_KEY);
      return Promise.resolve();
    }
    return value ? SecureStore.setItemAsync(STORAGE_KEY, value) : SecureStore.deleteItemAsync(STORAGE_KEY);
  },
};

/** Lido uma vez ao abrir o app; as requisições esperam por ele. */
export const deviceCashRegisterReady: Promise<void> = storage
  .get()
  .then((value) => {
    current = value;
    listeners.forEach((l) => l());
  })
  .catch(() => undefined);

export function getDeviceCashRegisterId() {
  return current;
}

export function setDeviceCashRegisterId(id: string | null) {
  if (id === current) return;
  current = id;
  storage.set(id).catch(() => {
    // Sem armazenamento: vale enquanto o app estiver aberto.
  });
  listeners.forEach((l) => l());
}

/** Para `useSyncExternalStore`. */
export function subscribeDeviceCashRegister(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
