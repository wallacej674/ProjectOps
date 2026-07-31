import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch } from "../../../test/mockApi";

const project = makeProject({
  id: 7,
  name: "CivicPermit API",
  description: "Permit workflow service",
  production_url: "https://civicpermit.example.com/health",
  updated_at: "2026-02-01T00:00:00Z",
});

const repo = {
  id: 3,
  project_id: 7,
  provider: "github",
  repo_owner: "openai",
  repo_name: "codex",
  repo_url: "https://github.com/openai/codex",
  default_branch: "main",
  is_connected: true,
  last_verified_at: "2026-01-02T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const completedAnalysis = {
  id: 12,
  project_id: 7,
  repo_integration_id: 3,
  status: "completed",
  summary: "Paths show a FastAPI backend and React frontend.",
  detected_stack: { languages: ["python", "typescript"] },
  detected_files: ["README.md"],
  detected_folders: ["backend", "frontend"],
  signals: { has_readme: true },
  warnings: [],
  error_message: null,
  total_files_scanned: 42,
  created_at: "2026-01-03T12:00:00Z",
};

const healthyCheck = {
  id: 21,
  project_id: 7,
  target_url: "https://civicpermit.example.com/health",
  status: "healthy",
  http_status_code: 200,
  response_time_ms: 184,
  checked_at: "2026-01-04T00:00:00Z",
  error_message: null,
  response_preview: "ok",
  created_at: "2026-01-04T00:00:01Z",
};

const artifact = {
  id: 41,
  project_id: 7,
  title: "Deployment runbook",
  artifact_type: "runbook",
  source_type: "external_url",
  url: "https://docs.example.com/runbook",
  content: null,
  summary: "Production deployment steps.",
  tags: "deployment,runbook",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-06T00:00:00Z",
};

const activityEvent = {
  id: 51,
  project_id: 7,
  event_type: "artifact_created",
  event_category: "artifact",
  message: "Artifact was created.",
  related_resource_type: "project_artifact",
  related_resource_id: 41,
  metadata: { title: "Deployment runbook" },
  created_at: "2026-01-07T12:00:00Z",
};

const healthActivityEvent = {
  id: 50,
  project_id: 7,
  event_type: "health_check_healthy",
  event_category: "health",
  message: "Manual health check was healthy.",
  related_resource_type: "health_check",
  related_resource_id: 21,
  metadata: { http_status_code: 200 },
  created_at: "2026-01-06T12:00:00Z",
};

const notStartedReadiness = {
  score: null,
  status: "not_started",
  passed: 0,
  failed: 0,
  unknown: 0,
  not_applicable: 0,
  total_applicable: 0,
  top_gaps: [],
  items: [],
};

const evaluatedReadiness = {
  score: 44,
  status: "needs_work",
  passed: 4,
  failed: 2,
  unknown: 3,
  not_applicable: 0,
  total_applicable: 9,
  top_gaps: ["CI Configured"],
  items: [
    {
      id: 31,
      project_id: 7,
      readiness_item_id: 9,
      item: {
        id: 9,
        key: "secrets_management_reviewed",
        label: "Secrets Management Reviewed",
        description: "An engineer has reviewed how secrets and credentials are managed.",
        category: "engineering_review",
        evaluation_type: "manual",
        sort_order: 90,
        is_active: true,
      },
      status: "unknown",
      source: "manual",
      evidence: null,
      notes: null,
      evaluated_at: "2026-01-01T00:00:00Z",
    },
  ],
};

function renderDetail() {
  window.history.pushState({}, "", "/app/projects/7");
  return render(<App />);
}

function responseClone(response: Response) {
  return response.clone();
}

function mockProjectDetail({
  projectResponse = json(project),
  repoResponse = json(repo),
  latestAnalysisResponse = json(completedAnalysis),
  analysisHistoryResponse = json([completedAnalysis]),
  latestHealthResponse = json(healthyCheck),
  healthHistoryResponse = json([healthyCheck]),
  readinessResponse = json(evaluatedReadiness),
  artifactsResponse = json([]),
  activityResponse = json([]),
  healthActivityResponse = json([]),
}: {
  projectResponse?: Response;
  repoResponse?: Response;
  latestAnalysisResponse?: Response;
  analysisHistoryResponse?: Response;
  latestHealthResponse?: Response;
  healthHistoryResponse?: Response;
  readinessResponse?: Response;
  artifactsResponse?: Response;
  activityResponse?: Response;
  healthActivityResponse?: Response;
} = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/projects/7") && method === "GET") return responseClone(projectResponse);
    if (url.endsWith("/api/v1/projects/7/repo") && method === "GET") return responseClone(repoResponse);
    if (url.endsWith("/api/v1/projects/7/analyses/latest") && method === "GET") {
      return responseClone(latestAnalysisResponse);
    }
    if (url.endsWith("/api/v1/projects/7/analyses") && method === "GET") {
      return responseClone(analysisHistoryResponse);
    }
    if (url.endsWith("/api/v1/projects/7/health-checks/latest") && method === "GET") {
      return responseClone(latestHealthResponse);
    }
    if (url.endsWith("/api/v1/projects/7/health-checks") && method === "GET") {
      return responseClone(healthHistoryResponse);
    }
    if (url.endsWith("/api/v1/projects/7/readiness") && method === "GET") return responseClone(readinessResponse);
    if (url.endsWith("/api/v1/projects/7/artifacts") && method === "GET") return responseClone(artifactsResponse);
    if (url.endsWith("/api/v1/projects/7/activity?category=health") && method === "GET") {
      return responseClone(healthActivityResponse);
    }
    if (url.endsWith("/api/v1/projects/7/activity") && method === "GET") return responseClone(activityResponse);
    return json([]);
  });
}

describe("Project detail unified command center", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders summary cards from loaded state without fake metrics", async () => {
    mockProjectDetail({
      projectResponse: json(makeProject({ id: 7, name: "CivicPermit API", production_url: null })),
      repoResponse: json({ detail: "Project 7 does not have an attached repo." }, 404),
      latestAnalysisResponse: json({ detail: "Project 7 does not have a repo analysis yet." }, 404),
      analysisHistoryResponse: json([]),
      latestHealthResponse: json({ detail: "Project 7 does not have a health check yet." }, 404),
      healthHistoryResponse: json([]),
      readinessResponse: json(notStartedReadiness),
    });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(within(commandCenter).getByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    expect(within(commandCenter).getByText("No repository connected")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Repository required")).toBeInTheDocument();
    expect(within(commandCenter).getByText("No production URL")).toBeInTheDocument();
    expect(within(commandCenter).getByText("No readiness evaluation")).toBeInTheDocument();
    expect(within(commandCenter).getByRole("link", { name: "Attach a GitHub repository." })).toHaveAttribute(
      "href",
      "#repository",
    );
    expect(within(commandCenter).queryByText("42 files")).not.toBeInTheDocument();
    expect(within(commandCenter).queryByText("184 ms")).not.toBeInTheDocument();
    expect(within(commandCenter).queryByText("44/100")).not.toBeInTheDocument();
  });

  it("prioritizes CodeMap after a repository is connected", async () => {
    mockProjectDetail({
      latestAnalysisResponse: json({ detail: "Project 7 does not have a repo analysis yet." }, 404),
      analysisHistoryResponse: json([]),
      readinessResponse: json(notStartedReadiness),
    });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(within(commandCenter).getByRole("link", { name: "Run CodeMap Lite analysis." })).toHaveAttribute(
      "href",
      "#codemap",
    );
    expect(within(commandCenter).getByText("openai/codex")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Repository connected, but CodeMap Lite has not run yet.")).toBeInTheDocument();
  });

  it("prioritizes health checks when production URL exists and no check has run", async () => {
    mockProjectDetail({
      latestHealthResponse: json({ detail: "Project 7 does not have a health check yet." }, 404),
      healthHistoryResponse: json([]),
      readinessResponse: json(notStartedReadiness),
    });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(within(commandCenter).getByRole("link", { name: "Run a manual health check." })).toHaveAttribute(
      "href",
      "#health",
    );
    expect(within(commandCenter).getByText("Ready for manual check")).toBeInTheDocument();
  });

  it("shows readiness score, artifact count, activity summary, section navigation, and existing detail sections", async () => {
    mockProjectDetail({ artifactsResponse: json([artifact]), activityResponse: json([activityEvent]) });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(await within(commandCenter).findByText("42 files")).toBeInTheDocument();
    expect(await within(commandCenter).findByText("184 ms")).toBeInTheDocument();
    expect(within(commandCenter).getByText("44/100")).toBeInTheDocument();
    expect(within(commandCenter).getByText("1 active artifact")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Most recent: Deployment runbook")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Latest activity")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Artifact was created.")).toBeInTheDocument();
    expect(within(commandCenter).getByRole("link", { name: "Review readiness gap: CI Configured" })).toHaveAttribute(
      "href",
      "#readiness",
    );

    const nav = screen.getByRole("navigation", { name: "Project sections" });
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "#overview");
    expect(within(nav).getByRole("link", { name: "Repository" })).toHaveAttribute("href", "#repository");
    expect(within(nav).getByRole("link", { name: "CodeMap" })).toHaveAttribute("href", "#codemap");
    expect(within(nav).getByRole("link", { name: "Health" })).toHaveAttribute("href", "#health");
    expect(within(nav).getByRole("link", { name: "Readiness" })).toHaveAttribute("href", "#readiness");
    expect(within(nav).getByRole("link", { name: "Artifacts" })).toHaveAttribute("href", "#artifacts");
    expect(within(nav).getByRole("link", { name: "Activity" })).toHaveAttribute("href", "#activity");
    expect(within(nav).getByRole("link", { name: "Details" })).toHaveAttribute("href", "#details");

    expect(screen.getByRole("region", { name: "Repository Connection" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "CodeMap Lite Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Health Monitoring" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Production Readiness" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Project Artifacts" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recent Activity" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Project Details" })).toBeInTheDocument();
  });

  it("keeps Project metadata visible when activity loading fails", async () => {
    mockProjectDetail({
      activityResponse: json({ detail: "Activity service unavailable." }, 500),
    });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(within(commandCenter).getByText("CivicPermit API")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Repository Connection" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recent Activity" })).toBeInTheDocument();
    expect(await within(screen.getByRole("region", { name: "Recent Activity" })).findByRole("alert")).toHaveTextContent(
      "Activity service unavailable.",
    );
  });

  it("keeps the Activity summary card stable when the timeline category filter changes", async () => {
    const user = userEvent.setup();
    const fetchMock = mockProjectDetail({
      artifactsResponse: json([artifact]),
      activityResponse: json([activityEvent, healthActivityEvent]),
      healthActivityResponse: json([healthActivityEvent]),
    });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(await within(commandCenter).findByText("2 events")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Artifact was created.")).toBeInTheDocument();

    const activityRegion = screen.getByRole("region", { name: "Recent Activity" });
    await user.selectOptions(within(activityRegion).getByLabelText("Filter activity by category"), "health");
    expect(await within(activityRegion).findByText("Manual health check was healthy.")).toBeInTheDocument();

    expect(within(commandCenter).getByText("2 events")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Artifact was created.")).toBeInTheDocument();
    await user.click(within(activityRegion).getByRole("button", { name: "Refresh activity" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/activity?category=health",
      expect.any(Object),
    );
  });

  it("keeps the command center visible when a section-specific backend request fails", async () => {
    mockProjectDetail({
      latestHealthResponse: json({ detail: "Health service unavailable." }, 500),
    });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(within(commandCenter).getByText("CivicPermit API")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Repository Connection" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "CodeMap Lite Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Health Monitoring" })).toBeInTheDocument();
    expect(await within(screen.getByRole("region", { name: "Health Monitoring" })).findByRole("alert")).toHaveTextContent(
      "Health service unavailable.",
    );
  });

  it("ignores malformed optional section payloads instead of hiding Project detail", async () => {
    mockProjectDetail({
      repoResponse: json(project),
      latestAnalysisResponse: json(project),
      latestHealthResponse: json({ status: "healthy", target_url: "https://example.com", checked_at: "2026-01-01T00:00:00Z" }),
      readinessResponse: json({ status: "needs_work", score: null, items: [] }),
    });

    renderDetail();

    const commandCenter = await screen.findByRole("region", { name: "Project Command Center" });
    expect(within(commandCenter).getByText("CivicPermit API")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Repository Connection" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "CodeMap Lite Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Health Monitoring" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Production Readiness" })).toBeInTheDocument();
    expect(within(commandCenter).queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
