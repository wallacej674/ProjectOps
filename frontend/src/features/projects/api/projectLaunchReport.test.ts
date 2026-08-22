import { getProjectLaunchChecklist, getProjectLaunchReport } from "./projectLaunchReport";

const launchReport = {
  project: {
    id: 7,
    name: "CivicPermit API",
    description: "Permit workflow service",
    repo_url: "https://github.com/openai/codex",
    production_url: "https://civicpermit.example.com/health",
    status: "development",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  generated_at: "2026-01-08T12:00:00Z",
  decision: "not_ready",
  headline: "CivicPermit API is not ready for launch.",
  readiness: {
    score: 44,
    status: "needs_work",
    passed: 4,
    failed: 2,
    unknown: 3,
    not_applicable: 0,
    total_applicable: 9,
    top_gaps: ["CI Configured"],
  },
  evidence_summary: {
    repository_connected: true,
    codemap_completed: true,
    health_check_healthy: true,
    production_url_configured: true,
    active_artifacts: 1,
    linked_active_artifacts: 1,
    unlinked_active_artifacts: 0,
    readiness_items_with_linked_artifacts: 1,
    readiness_items_without_linked_artifacts: 2,
    total_evidence_links: 1,
    activity_events: 2,
  },
  blockers: ["CI Configured"],
  recommended_actions: ["Review readiness gap: CI Configured."],
};

const launchChecklist = {
  project: launchReport.project,
  generated_at: "2026-01-08T12:00:00Z",
  summary: {
    done: 3,
    needs_attention: 1,
    todo: 4,
    total: 8,
  },
  items: [
    {
      key: "repository_connected",
      label: "Repository connected",
      status: "done",
      description: "A Repo Integration is required before CodeMap Lite can add repository evidence.",
      action: "Attach a public GitHub repository.",
      target: "#repository",
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project launch report API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gets the launch report for a Project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(launchReport));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProjectLaunchReport("7")).resolves.toEqual(launchReport);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/launch-report",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("preserves backend errors when the launch report cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Project 7 was not found." }, 404)));

    await expect(getProjectLaunchReport("7")).rejects.toMatchObject({
      kind: "not-found",
      message: "Project 7 was not found.",
    });
  });

  it("gets the guided launch checklist for a Project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(launchChecklist));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProjectLaunchChecklist("7")).resolves.toEqual(launchChecklist);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/launch-checklist",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });
});
