import { request } from "./client";
import { clearStoredAuth, storeAuthSession } from "./authStorage";
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from "./authTypes";

function storeAndReturn(session: AuthSession): AuthSession {
  storeAuthSession(session.access_token, session.user);
  return session;
}

export const authApi = {
  async register(input: RegisterInput) {
    const session = await request<AuthSession>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return storeAndReturn(session);
  },
  async login(input: LoginInput) {
    const session = await request<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return storeAndReturn(session);
  },
  me: () => request<AuthUser>("/api/v1/auth/me"),
  logout() {
    clearStoredAuth();
  },
};
