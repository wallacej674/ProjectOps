import { request, resolveApiBaseUrl } from "./client";

describe("API client", () => {
  afterEach(() => {
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

  it("explains production API URL misconfiguration before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => resolveApiBaseUrl({ PROD: true })).toThrow("VITE_API_BASE_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
