import { request } from "./client";

describe("API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns successful JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await expect(request<{ id: number }>("/projects")).resolves.toEqual({ id: 1 });
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
});
