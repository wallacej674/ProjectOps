import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../../api/auth";
import { clearStoredAuth, getStoredAuthToken, getStoredAuthUser, storeAuthSession } from "../../api/authStorage";
import type { AuthUser, LoginInput, RegisterInput } from "../../api/authTypes";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  authenticated: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): void;
  setUser(user: AuthUser): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => getStoredAuthToken());
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuthUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      authenticated: Boolean(token),
      async login(input) {
        const session = await authApi.login(input);
        setToken(session.access_token);
        setUser(session.user);
      },
      async register(input) {
        const session = await authApi.register(input);
        setToken(session.access_token);
        setUser(session.user);
      },
      logout() {
        clearStoredAuth();
        setToken(null);
        setUser(null);
      },
      setUser(nextUser) {
        setUser(nextUser);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export function setTestAuthSession(token: string, user: AuthUser) {
  storeAuthSession(token, user);
}
