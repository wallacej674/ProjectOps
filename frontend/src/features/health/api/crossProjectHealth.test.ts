import { listCrossProjectHealth } from "./crossProjectHealth";

const summary = {
  project_id: 7,
  project_name: "CivicPermit API",
  project_status: "development",
  production_url: "https://civicpermit.example.com",
  latest_check: {
    id: 21,
    project_id: 7,
    target_url: "https://civicpermit.example.com",
    status: "healthy",
    execution_source: "manual",
    http_status_code: 200,
    response_time_ms: 184,
    checked_at: "2026-01-04T00:00:00Z",
    error_message: null,
    response_preview: "ok",
    created_at: "2026-01-04T00:00:01Z",
  },
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Cross-project health API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the latest health check per project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([summary]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCrossProjectHealth()).resolves.toEqual([summary]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/health-checks",
      expect.any(Object),
    );
  });
});
