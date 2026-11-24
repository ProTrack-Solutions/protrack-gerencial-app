import { isAxiosError } from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { User } from "@/interfaces/auth.interface";
import { setSessionExpiredHandler, tokenStorage } from "@/service/api.service";
import { AUTH_AUDIENCE, GetMe, Login, Logout } from "@/service/auth.service";
import { clearBiometricData } from "@/utils/clear-biometric-data";
import { loginTransition } from "@/utils/login-transition";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  /** Busca de novo os dados do usuário (ex: depois de editar o perfil). */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const endSession = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Senha guardada pelo antigo login por biometria não pode ficar no aparelho.
  useEffect(() => {
    clearBiometricData();
  }, []);

  // Restaura a sessão salva ao abrir o app.
  useEffect(() => {
    setSessionExpiredHandler(endSession);

    (async () => {
      const token = await tokenStorage.getAccessToken();
      if (!token) return endSession();

      try {
        setUser(await GetMe());
        setStatus("authenticated");
      } catch (error) {
        // Sem conexão: mantém a sessão; os dados do usuário vêm depois.
        if (isAxiosError(error) && !error.response) {
          setStatus("authenticated");
          return;
        }
        await tokenStorage.clear();
        endSession();
      }
    })();

    return () => setSessionExpiredHandler(null);
  }, [endSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const tokens = await Login({ email, password, aud: AUTH_AUDIENCE });
    await tokenStorage.save(tokens.access_token, tokens.refresh_token);
    let me: User;
    try {
      me = await GetMe();
    } catch (error) {
      await tokenStorage.clear();
      throw error;
    }
    setUser(me);
    // O líquido cobre o login; a troca para o painel acontece por baixo dele.
    await loginTransition.cover();
    setStatus("authenticated");
    return me;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await Logout();
    } catch {
      // Mesmo se a API falhar, a sessão local é encerrada.
    }
    await tokenStorage.clear();
    endSession();
  }, [endSession]);

  const refreshUser = useCallback(async () => {
    setUser(await GetMe());
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, refreshUser }),
    [status, user, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return context;
}
