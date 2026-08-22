import { request, resolveApiBaseUrl } from "./client";
import { clearStoredAuth } from "./authStorage";

describe("API client", () => {
  afterEach(() => {
    clearStoredAuth();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns successful JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await expect(request<{ id: number }>("/projects")).resolves.toEqual({ id: 1 });
  });

  it("uses a configured API base URL without a trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.projectops.example/");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request<{ status: string }>("/health")).resolves.toEqual({ status: "ok" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.projectops.example/health", expect.any(Object));
  });

  it("handles an empty successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request<void>("/projects/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("preserves backend validation and missing-resource errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ detail: [{ msg: "Field required" }] }), { status: 422 })).mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Project 4 was not found." }), { status: 404 })));
    await expect(request("/projects")).rejects.toMatchObject({ kind: "validation", message: "Field required" });
    await expect(request("/projects/4")).rejects.toMatchObject({ kind: "not-found", message: "Project 4 was not found." });
  });

  it("attaches an auth token to protected requests", async () => {
    localStorage.setItem("projectops.auth.token", "secret-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/api/v1/projects");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret-token" }),
      }),
    );
  });

  it("does not attach Authorization without a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/api/v1/projects");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects",
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
  });

  it("classifies 401 responses as auth errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Authentication required." }), { status: 401 })));

    await expect(request("/api/v1/projects")).rejects.toMatchObject({
      kind: "auth",
      message: "Authentication required.",
    });
  });

  it("attaches request IDs and retry timing to failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Too many attempts." }), {
          status: 429,
          headers: {
            "X-Request-ID": "frontend-request-789",
            "Retry-After": "60",
          },
        }),
      ),
    );

    await expect(request("/api/v1/projects/1/health-checks/run", { method: "POST" })).rejects.toMatchObject({
      message: "Too many attempts.",
      requestId: "frontend-request-789",
      retryAfter: "60",
      status: 429,
    });
  });

  it("explains production API URL misconfiguration before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => resolveApiBaseUrl({ PROD: true })).toThrow("VITE_API_BASE_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
