export interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
}

export interface RegisterInput {
  email: string;
  password: string;
  display_name?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  display_name: string | null;
}

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}
