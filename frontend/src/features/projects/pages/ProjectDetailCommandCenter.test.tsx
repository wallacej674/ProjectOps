import { act, render, screen, waitFor, within } from "@testing-library/react";
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
  created_by_user_id: 3,
  created_by_user: {
    id: 3,
    email: "reviewer@example.com",
    display_name: "Release Reviewer",
  },
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

const launchDecisionArtifact = {
  id: 42,
  project_id: 7,
  created_by_user_id: 3,
  created_by_user: {
    id: 3,
    email: "reviewer@example.com",
    display_name: "Release Reviewer",
  },
  title: "Launch decision: No-go",
  artifact_type: "decision",
  source_type: "manual",
  url: null,
  content: "Decision: no-go\n\nNotes:\nHold launch until CI is configured.",
  summary: "Hold launch until CI is configured.",
  tags: "launch-decision,go-no-go,no-go",
  status: "active",
  created_at: "2026-01-08T00:00:00Z",
  updated_at: "2026-01-08T00:00:00Z",
};

const olderGoLaunchDecisionArtifact = {
  ...launchDecisionArtifact,
  id: 43,
  title: "Launch decision: Go",
  content: "Decision: go\n\nNotes:\nRelease owner accepted the launch window.",
  summary: "Release owner accepted the launch window.",
  tags: "launch-decision,go-no-go,go",
  created_at: "2026-01-07T12:00:00Z",
  updated_at: "2026-01-07T12:00:00Z",
};

const unrelatedDecisionArtifact = {
  ...launchDecisionArtifact,
  id: 44,
  title: "Architecture decision",
  content: "Use managed Postgres.",
  summary: "Database hosting direction.",
  tags: "architecture,adr",
  created_at: "2026-01-09T12:00:00Z",
  updated_at: "2026-01-09T12:00:00Z",
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

const launchReport = {
  project,
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
  project,
  generated_at: "2026-01-08T12:00:00Z",
  summary: {
    done: 4,
    needs_attention: 1,
    todo: 4,
    total: 9,
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
    {
      key: "health_check_healthy",
      label: "Latest health check healthy",
      status: "done",
      description: "A healthy manual Health Check provides basic hosted reachability evidence.",
      action: "Run or review the manual health check.",
      target: "#health",
    },
    {
      key: "supporting_evidence_linked",
      label: "Supporting evidence linked",
      status: "done",
      description: "Linked artifacts are supporting references supplied by your team; ProjectOps does not verify their contents.",
      action: "Link artifacts to readiness items.",
      target: "#readiness",
    },
    {
      key: "human_launch_review",
      label: "Human launch review completed",
      status: "needs_attention",
      description: "ProjectOps provides advisory evidence; a person still makes the go/no-go decision.",
      action: "Review the Launch Report with the deployment owner.",
      target: "#launch-report",
    },
  ],
};

function renderDetail(suffix = "") {
  window.history.pushState({}, "", "/app/projects/7" + suffix);
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
  launchReportResponse = json(launchReport),
  launchChecklistResponse = json(launchChecklist),
  artifactsResponse = json([]),
  launchDecisionResponse = json([launchDecisionArtifact]),
  createArtifactResponse = json(launchDecisionArtifact),
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
  launchReportResponse?: Response;
  launchChecklistResponse?: Response;
  artifactsResponse?: Response;
  launchDecisionResponse?: Response;
  createArtifactResponse?: Response;
  activityResponse?: Response;
  healthActivityResponse?: Response;
} = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.includes("/health-alerts") && method === "GET") return json({ items: [], total: 0 });
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
    if (url.endsWith("/api/v1/projects/7/launch-report") && method === "GET") {
      return responseClone(launchReportResponse);
    }
    if (url.endsWith("/api/v1/projects/7/launch-checklist") && method === "GET") {
      return responseClone(launchChecklistResponse);
    }
    if (
      url.includes("/api/v1/projects/7/artifacts?") &&
      url.includes("artifact_type=decision") &&
      url.includes("tags=launch-decision") &&
      method === "GET"
    ) {
      return responseClone(launchDecisionResponse);
    }
    if (url.endsWith("/api/v1/projects/7/artifacts") && method === "POST") {
      return responseClone(createArtifactResponse);
    }
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

  it("renders the operations map from loaded state without fake metrics", async () => {
    const user = userEvent.setup();
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

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(within(commandCenter).getByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    expect(within(commandCenter).getByText("No repository connected")).toBeInTheDocument();
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect CodeMap: Not ready" }));
    expect(within(commandCenter).getByText("Repository required")).toBeInTheDocument();
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect Production health: No target" }));
    expect(within(commandCenter).getByText("No production URL")).toBeInTheDocument();
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect Readiness: Not evaluated" }));
    expect(within(commandCenter).getByText("No readiness evaluation")).toBeInTheDocument();
    expect(within(commandCenter).getAllByRole("link", { name: "Attach a GitHub repository." })[0]).toHaveAttribute(
      "href",
      "#repository",
    );
    expect(within(commandCenter).queryByText("42 files")).not.toBeInTheDocument();
    expect(within(commandCenter).queryByText("184 ms")).not.toBeInTheDocument();
    expect(within(commandCenter).queryByText("44/100")).not.toBeInTheDocument();
  });

  it("prioritizes CodeMap after a repository is connected", async () => {
    const user = userEvent.setup();
    mockProjectDetail({
      latestAnalysisResponse: json({ detail: "Project 7 does not have a repo analysis yet." }, 404),
      analysisHistoryResponse: json([]),
      readinessResponse: json(notStartedReadiness),
    });

    renderDetail();

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(within(commandCenter).getAllByRole("link", { name: "Run CodeMap Lite analysis." })[0]).toHaveAttribute(
      "href",
      "#codemap",
    );
    expect(within(commandCenter).getByText("openai/codex")).toBeInTheDocument();
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect CodeMap: Not run" }));
    expect(within(commandCenter).getAllByText("Repository connected, but CodeMap Lite has not run yet.")[0]).toBeInTheDocument();
  });

  it("prioritizes health checks when production URL exists and no check has run", async () => {
    const user = userEvent.setup();
    mockProjectDetail({
      latestHealthResponse: json({ detail: "Project 7 does not have a health check yet." }, 404),
      healthHistoryResponse: json([]),
      readinessResponse: json(notStartedReadiness),
    });

    renderDetail();

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(within(commandCenter).getAllByRole("link", { name: "Run a manual health check." })[0]).toHaveAttribute(
      "href",
      "#health",
    );
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect Production health: Not checked" }));
    expect(within(commandCenter).getByText("Ready for manual check")).toBeInTheDocument();
  });

  it("shows readiness score, artifact count, activity summary, section navigation, and existing detail sections", async () => {
    const user = userEvent.setup();
    mockProjectDetail({ artifactsResponse: json([artifact]), activityResponse: json([activityEvent]) });

    renderDetail();

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(await within(commandCenter).findByText("42 files")).toBeInTheDocument();
    expect(await within(commandCenter).findByText("184 ms")).toBeInTheDocument();
    expect(within(commandCenter).getByText("44/100")).toBeInTheDocument();
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect Artifacts: 1 active" }));
    expect(within(commandCenter).getByText("1 active artifact")).toBeInTheDocument();
    expect(within(commandCenter).getAllByText("Most recent: Deployment runbook")[0]).toBeInTheDocument();
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect Activity: 1 event" }));
    expect(within(commandCenter).getByText("Latest activity")).toBeInTheDocument();
    expect(within(commandCenter).getByText("Artifact was created.")).toBeInTheDocument();
    expect(within(commandCenter).getAllByRole("link", { name: "Review readiness gap: CI Configured" })[0]).toHaveAttribute(
      "href",
      "#readiness",
    );

    const nav = screen.getByRole("navigation", { name: "Project sections" });
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("region", { name: "Health Monitoring" })).not.toBeInTheDocument();
    for (const [view, region] of [["Repository", "Repository Analysis"], ["Monitoring", "Health Monitoring"], ["Launch", "Production Readiness"], ["Artifacts", "Project Artifacts"], ["Activity", "Recent Activity"], ["Settings", "Project Details"]]) {
      await user.click(within(nav).getByRole("link", { name: view }));
      expect(await screen.findByRole("region", { name: region })).toBeInTheDocument();
      expect(within(nav).getByRole("link", { name: view })).toHaveAttribute("aria-current", "page");
      expect(window.location.search).toBe("?view=" + view.toLowerCase());
    }
  });

  it("shows the launch report decision with evidence coverage and next actions", async () => {
    mockProjectDetail({ artifactsResponse: json([artifact]), activityResponse: json([activityEvent, healthActivityEvent]) });

    renderDetail();

    await userEvent.setup().click(within(await screen.findByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Launch" }));
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Launch views" })).getByRole("link", { name: "Report" }));
    const report = await screen.findByRole("region", { name: "Launch Report" });
    expect(within(report).getByText("CivicPermit API is not ready for launch.")).toBeInTheDocument();
    expect(within(report).getByText("Not ready")).toBeInTheDocument();
    expect(within(report).getByText(/44\/100 readiness/)).toBeInTheDocument();
    expect(within(report).getByText("Repository connected")).toBeInTheDocument();
    expect(within(report).getByText("CodeMap completed")).toBeInTheDocument();
    expect(within(report).getByText("Health check healthy")).toBeInTheDocument();
    expect(within(report).getByText("Production URL configured")).toBeInTheDocument();
    expect(within(report).getByText("Linked active artifacts")).toBeInTheDocument();
    expect(within(report).getByText("Readiness items with supporting artifacts")).toBeInTheDocument();
    expect(within(report).getAllByText("1").length).toBeGreaterThan(0);
    expect(within(report).getByText("CI Configured")).toBeInTheDocument();
    expect(within(report).getByRole("link", { name: "Review readiness gap: CI Configured." })).toHaveAttribute(
      "href",
      "#readiness",
    );
  });

  it("shows the guided launch checklist with status counts and action targets", async () => {
    mockProjectDetail();

    renderDetail();

    await userEvent.setup().click(within(await screen.findByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Launch" }));
    await userEvent.setup().click(screen.getByText("Guided launch checklist"));
    const checklist = await screen.findByRole("region", { name: "Guided Launch Checklist" });
    const checklistSummary = within(checklist).getByLabelText("Launch checklist summary");
    expect(within(checklistSummary).getByText("Done").closest(".stat-cell")).toHaveTextContent("4");
    expect(within(checklistSummary).getByText("Needs attention").closest(".stat-cell")).toHaveTextContent("1");
    expect(within(checklistSummary).getByText("Todo").closest(".stat-cell")).toHaveTextContent("4");
    expect(within(checklist).getByText("Repository connected")).toBeInTheDocument();
    expect(within(checklist).getByText("Supporting evidence linked")).toBeInTheDocument();
    expect(within(checklist).getByRole("link", { name: "Link artifacts to readiness items." })).toHaveAttribute(
      "href",
      "#readiness",
    );
    expect(within(checklist).getByText("Human launch review completed")).toBeInTheDocument();
    expect(within(checklist).getByRole("link", { name: "Review the Launch Report with the deployment owner." })).toHaveAttribute(
      "href",
      "#launch-report",
    );
  });

  it("records a launch decision as a Project decision artifact", async () => {
    const user = userEvent.setup();
    const fetchMock = mockProjectDetail({
      launchDecisionResponse: json([launchDecisionArtifact]),
      createArtifactResponse: json({
        ...launchDecisionArtifact,
        id: 99,
        title: "Launch decision: Defer",
        content: "Decision: defer\n\nNotes:\nWait for hosted smoke evidence.",
        summary: "Wait for hosted smoke evidence.",
        tags: "launch-decision,go-no-go,defer",
      }),
    });

    renderDetail();

    await userEvent.setup().click(within(await screen.findByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Launch" }));
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Launch views" })).getByRole("link", { name: "Decisions" }));
    const decision = await screen.findByRole("region", { name: "Launch Decision" });
    expect(within(decision).getAllByText("Launch decision: No-go").length).toBeGreaterThan(0);
    expect(within(decision).getAllByText("Hold launch until CI is configured.").length).toBeGreaterThan(0);

    await user.type(within(decision).getByLabelText("Decision notes"), "Wait for hosted smoke evidence.");
    await user.click(within(decision).getByRole("button", { name: "Record Launch Decision" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/artifacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Launch decision: Defer",
          artifact_type: "decision",
          source_type: "manual",
          url: null,
          summary: "Wait for hosted smoke evidence.",
          content: "Decision: defer\n\nNotes:\nWait for hosted smoke evidence.",
          tags: "launch-decision,go-no-go,defer",
        }),
      }),
    );
  });

  it("renders launch decision history from Project Artifacts and ignores unrelated decisions", async () => {
    mockProjectDetail({
      launchDecisionResponse: json([
        olderGoLaunchDecisionArtifact,
        unrelatedDecisionArtifact,
        launchDecisionArtifact,
      ]),
    });

    renderDetail();

    await userEvent.setup().click(within(await screen.findByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Launch" }));
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Launch views" })).getByRole("link", { name: "Decisions" }));
    const decision = await screen.findByRole("region", { name: "Launch Decision" });
    expect(within(decision).getAllByText("Launch decision: No-go").length).toBeGreaterThan(0);
    expect(within(decision).getAllByText("Hold launch until CI is configured.").length).toBeGreaterThan(0);
    expect(within(decision).getByText("Release owner accepted the launch window.")).toBeInTheDocument();
    expect(within(decision).queryByText("Architecture decision")).not.toBeInTheDocument();
  });

  it("keeps Project metadata visible when activity loading fails", async () => {
    mockProjectDetail({
      activityResponse: json({ detail: "Activity service unavailable." }, 500),
    });

    renderDetail();

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(within(commandCenter).getByText("CivicPermit API")).toBeInTheDocument();
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Activity" }));
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

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(await within(commandCenter).findByText("2 events")).toBeInTheDocument();
    await user.click(within(commandCenter).getByRole("button", { name: "Inspect Activity: 2 events" }));
    expect(within(commandCenter).getByText("Artifact was created.")).toBeInTheDocument();

    await user.click(within(screen.getByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Activity" }));
    const activityRegion = screen.getByRole("region", { name: "Recent Activity" });
    await user.selectOptions(within(activityRegion).getByLabelText("Filter activity by category"), "health");
    expect(await within(activityRegion).findByText("Manual health check was healthy.")).toBeInTheDocument();

    await user.click(within(activityRegion).getByRole("button", { name: "Refresh activity" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/activity?category=health",
      expect.any(Object),
    );
    await user.click(within(screen.getByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Overview" }));
    await user.click(screen.getByText("Project map and setup progress"));
    expect(within(commandCenter).getByRole("button", { name: "Inspect Activity: 2 events" })).toBeInTheDocument();
  });

  it("keeps the command center visible when a section-specific backend request fails", async () => {
    mockProjectDetail({
      latestHealthResponse: json({ detail: "Health service unavailable." }, 500),
    });

    renderDetail();

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(within(commandCenter).getByText("CivicPermit API")).toBeInTheDocument();
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Monitoring" }));
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

    const header = await screen.findByRole("region", { name: "Project Command Center" });
    const commandCenter = header.parentElement!;
    await userEvent.setup().click(screen.getByText("Project map and setup progress"));
    expect(within(commandCenter).getByText("CivicPermit API")).toBeInTheDocument();
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Monitoring" }));
    expect(screen.getByRole("region", { name: "Health Monitoring" })).toBeInTheDocument();
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Launch" }));
    expect(screen.getByRole("region", { name: "Production Readiness" })).toBeInTheDocument();
    expect(within(commandCenter).queryByText(/undefined/)).not.toBeInTheDocument();
  });
});

describe("Project workspace navigation", () => {
  afterEach(() => vi.restoreAllMocks());
  it("opens legacy report links and follows their readiness action into the checklist", async () => {
    mockProjectDetail();
    renderDetail("#launch-report");
    const report = await screen.findByRole("region", { name: "Launch Report" });
    expect(screen.queryByRole("region", { name: "Health Monitoring" })).not.toBeInTheDocument();
    await userEvent.setup().click(within(report).getByRole("link", { name: "Review readiness gap: CI Configured." }));
    expect(await screen.findByRole("region", { name: "Production Readiness" })).toBeInTheDocument();
    expect(window.location.search).toBe("?view=launch&section=checklist");
    expect(screen.queryByRole("region", { name: "Launch Report" })).not.toBeInTheDocument();
  });
  it("supports keyboard navigation and browser back and forward between views", async () => {
    const user = userEvent.setup();
    mockProjectDetail();
    renderDetail("?view=repository");
    await screen.findByRole("region", { name: "Repository Analysis" });
    const monitoring = within(screen.getByRole("navigation", { name: "Project sections" })).getByRole("link", { name: "Monitoring" });
    monitoring.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("region", { name: "Health Monitoring" })).toBeInTheDocument();
    await act(async () => window.history.back());
    await waitFor(() => expect(screen.getByRole("region", { name: "Repository Analysis" })).toBeInTheDocument());
    await act(async () => window.history.forward());
    await waitFor(() => expect(screen.getByRole("region", { name: "Health Monitoring" })).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Repository Analysis" })).not.toBeInTheDocument();
  });
});
