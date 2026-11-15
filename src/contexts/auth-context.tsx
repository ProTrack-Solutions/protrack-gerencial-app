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
import {
  BiometricInvalidatedError,
  detectBiometricSupport,
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricProfile,
  markSignedOut,
  NO_BIOMETRIC_SUPPORT,
  readBiometricCredentials,
  type BiometricProfile,
  type BiometricSupport,
} from "@/utils/biometrics";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/** Erro do login por biometria já com a mensagem para o usuário. */
export class BiometricLoginError extends Error {}

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  /** Busca de novo os dados do usuário (ex: depois de editar o perfil). */
  refreshUser: () => Promise<void>;
  biometric: {
    support: BiometricSupport;
    /** Conta cadastrada para entrar com biometria neste aparelho. */
    profile: BiometricProfile | null;
    /** Pede a biometria e entra. Retorna `false` se o usuário cancelou. */
    signIn: () => Promise<boolean>;
    enable: (email: string, password: string, name: string) => Promise<void>;
    disable: () => Promise<void>;
  };
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [support, setSupport] = useState<BiometricSupport>(NO_BIOMETRIC_SUPPORT);
  const [profile, setProfile] = useState<BiometricProfile | null>(null);

  const endSession = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    detectBiometricSupport()
      .then(setSupport)
      .catch(() => undefined);
    getBiometricProfile().then(setProfile);
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
    setStatus("authenticated");
    return me;
  }, []);

  // Sair não remove a biometria: como no app do banco, a próxima entrada é pelo rosto/digital.
  const signOut = useCallback(async () => {
    try {
      await Logout();
    } catch {
      // Mesmo se a API falhar, a sessão local é encerrada.
    }
    await tokenStorage.clear();
    markSignedOut();
    endSession();
  }, [endSession]);

  const refreshUser = useCallback(async () => {
    setUser(await GetMe());
  }, []);

  const disableBiometric = useCallback(async () => {
    await disableBiometricLogin();
    setProfile(null);
  }, []);

  const enableBiometric = useCallback(
    async (email: string, password: string, name: string) => {
      await enableBiometricLogin(email, password, name, `Confirme para entrar com ${support.label}`);
      setProfile({ email, name });
    },
    [support.label],
  );

  const signInWithBiometrics = useCallback(async () => {
    let credentials;
    try {
      credentials = await readBiometricCredentials("Entrar no ProTrack");
    } catch (error) {
      if (error instanceof BiometricInvalidatedError) {
        setProfile(null);
        throw new BiometricLoginError(
          "A biometria do aparelho mudou. Entre com a senha para ativar de novo.",
        );
      }
      throw error;
    }
    if (!credentials) return false;
    try {
      await signIn(credentials.email, credentials.password);
      return true;
    } catch (error) {
      // Senha trocada (aqui ou no web): a guardada não vale mais.
      if (
        isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.data?.error === "invalid credentials")
      ) {
        await disableBiometric();
        throw new BiometricLoginError(
          "Sua senha mudou. Entre com a nova senha para ativar a biometria de novo.",
        );
      }
      throw error;
    }
  }, [signIn, disableBiometric]);

  const biometric = useMemo(
    () => ({ support, profile, signIn: signInWithBiometrics, enable: enableBiometric, disable: disableBiometric }),
    [support, profile, signInWithBiometrics, enableBiometric, disableBiometric],
  );

  const value = useMemo(
    () => ({ status, user, signIn, signOut, refreshUser, biometric }),
    [status, user, signIn, signOut, refreshUser, biometric],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return context;
}
