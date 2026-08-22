import { authApi } from "./auth";
import { clearStoredAuth, getStoredAuthToken } from "./authStorage";

describe("auth API", () => {
  afterEach(() => {
    clearStoredAuth();
    vi.restoreAllMocks();
  });

  it("registers a user and stores the returned token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "registered-token",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: 1, email: "engineer@example.com", display_name: "Engineer", status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
          }),
          { status: 201 },
        ),
      ),
    );

    const session = await authApi.register({
      email: "engineer@example.com",
      password: "correct horse battery staple",
      display_name: "Engineer",
    });

    expect(session.user.email).toBe("engineer@example.com");
    expect(getStoredAuthToken()).toBe("registered-token");
  });

  it("surfaces register validation errors without storing a token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ msg: "Enter a valid email address." }] }), { status: 422 })));

    await expect(authApi.register({ email: "bad", password: "password", display_name: "" })).rejects.toMatchObject({
      kind: "validation",
      message: "Enter a valid email address.",
    });
    expect(getStoredAuthToken()).toBeNull();
  });

  it("logs in and stores the returned token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "login-token",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: 1, email: "engineer@example.com", display_name: null, status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
          }),
          { status: 200 },
        ),
      ),
    );

    const session = await authApi.login({ email: "engineer@example.com", password: "correct horse battery staple" });

    expect(session.access_token).toBe("login-token");
    expect(getStoredAuthToken()).toBe("login-token");
  });

  it("keeps login failure generic", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid email or password." }), { status: 401 })));

    await expect(authApi.login({ email: "missing@example.com", password: "wrong" })).rejects.toMatchObject({
      kind: "auth",
      message: "Invalid email or password.",
    });
  });

  it("loads the current user with /me", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: 1, email: "engineer@example.com", display_name: null, status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }),
          { status: 200 },
        ),
      ),
    );

    await expect(authApi.me()).resolves.toMatchObject({ email: "engineer@example.com" });
  });

  it("clears token state on logout", () => {
    localStorage.setItem("projectops.auth.token", "token");

    authApi.logout();

    expect(getStoredAuthToken()).toBeNull();
  });
});
