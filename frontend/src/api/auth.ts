import { request } from "./client";
import { clearStoredAuth, storeAuthSession, updateStoredAuthUser } from "./authStorage";
import type {
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "./authTypes";

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
  async updateProfile(input: UpdateProfileInput) {
    const user = await request<AuthUser>("/api/v1/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    updateStoredAuthUser(user);
    return user;
  },
  changePassword(input: ChangePasswordInput) {
    return request<{ message: string }>("/api/v1/auth/me/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  logout() {
    clearStoredAuth();
  },
};
