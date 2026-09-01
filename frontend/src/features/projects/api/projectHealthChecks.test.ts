import {
  getLatestProjectHealthCheck,
  getProjectHealthMonitor,
  listProjectHealthChecks,
  pauseProjectHealthMonitor,
  runProjectHealthCheck,
  updateProjectHealthMonitor,
} from "./projectHealthChecks";

const healthCheck = {
  id: 21,
  project_id: 7,
  target_url: "https://launchbudget.example.com",
  status: "healthy",
  http_status_code: 200,
  response_time_ms: 184,
  checked_at: "2026-01-01T00:00:00Z",
  error_message: null,
  response_preview: "ok",
  created_at: "2026-01-01T00:00:01Z",
};

const healthMonitor = {
  project_id: 7,
  enabled: false,
  cadence_minutes: 60 as const,
  next_run_at: null,
  last_started_at: null,
  last_completed_at: null,
  last_outcome: null,
  consecutive_failures: 0,
  created_at: null,
  updated_at: null,
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project health check API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs a manual health check using the Project production URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(healthCheck, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runProjectHealthCheck("7")).resolves.toEqual(healthCheck);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/health-checks/run",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("runs a manual health check using a one-time override URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ...healthCheck, target_url: "https://status.example.com" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runProjectHealthCheck("7", { url: "https://status.example.com" })).resolves.toMatchObject({
      target_url: "https://status.example.com",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/health-checks/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://status.example.com" }),
      }),
    );
  });

  it("preserves the backend missing-target error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Provide a URL or set production_url on the Project." }, 400)),
    );

    await expect(runProjectHealthCheck("7")).rejects.toMatchObject({
      kind: "unknown",
      message: "Provide a URL or set production_url on the Project.",
    });
  });

  it("preserves backend SSRF-blocked validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Target '127.0.0.1' resolves to a non-public address." }, 422)),
    );

    await expect(runProjectHealthCheck("7", { url: "http://127.0.0.1" })).rejects.toMatchObject({
      kind: "validation",
      message: "Target '127.0.0.1' resolves to a non-public address.",
    });
  });

  it("gets the latest health check for a Project", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(healthCheck)));

    await expect(getLatestProjectHealthCheck("7")).resolves.toEqual(healthCheck);
  });

  it("preserves the backend no-health-check state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Project 7 does not have a health check yet." }, 404)),
    );

    await expect(getLatestProjectHealthCheck("7")).rejects.toMatchObject({
      kind: "not-found",
      message: "Project 7 does not have a health check yet.",
    });
  });

  it("lists health-check history for a Project", async () => {
    const olderHealthCheck = { ...healthCheck, id: 20, checked_at: "2025-12-31T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([healthCheck, olderHealthCheck])));

    await expect(listProjectHealthChecks("7")).resolves.toEqual([healthCheck, olderHealthCheck]);
  });

  it("preserves backend errors when health-check history cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Health check history unavailable." }, 500)));

    await expect(listProjectHealthChecks("7")).rejects.toMatchObject({
      kind: "unknown",
      message: "Health check history unavailable.",
    });
  });

  it("reads, enables, and pauses the Project health monitor", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(healthMonitor))
      .mockResolvedValueOnce(json({ ...healthMonitor, enabled: true }))
      .mockResolvedValueOnce(json(healthMonitor));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProjectHealthMonitor("7")).resolves.toEqual(healthMonitor);
    await expect(updateProjectHealthMonitor("7", { enabled: true, cadence_minutes: 60 })).resolves.toMatchObject({ enabled: true });
    await expect(pauseProjectHealthMonitor("7")).resolves.toMatchObject({ enabled: false });

    expect(fetchMock.mock.calls[1]).toEqual([
      "http://127.0.0.1:8000/api/v1/projects/7/health-monitor",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ enabled: true, cadence_minutes: 60 }) }),
    ]);
    expect(fetchMock.mock.calls[2]).toEqual([
      "http://127.0.0.1:8000/api/v1/projects/7/health-monitor",
      expect.objectContaining({ method: "DELETE" }),
    ]);
  });
});
