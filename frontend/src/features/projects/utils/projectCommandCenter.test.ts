import { describe, expect, it } from "vitest";
import type { HealthCheck } from "../../../types/healthCheck";
import type { Project } from "../../../types/project";
import type { ProjectArtifact } from "../../../types/projectArtifact";
import type { ProjectActivityEvent } from "../../../types/projectActivity";
import type { ProjectReadinessSummary } from "../../../types/readiness";
import type { RepoAnalysis } from "../../../types/repoAnalysis";
import type { RepoIntegration } from "../../../types/repoIntegration";
import {
  getCodeMapSummary,
  getArtifactsSummary,
  getActivitySummary,
  getHealthSummary,
  getProjectNextActions,
  getProjectSetupSteps,
  getReadinessSummary,
  getRepositorySummary,
} from "./projectCommandCenter";

const project: Project = {
  id: 7,
  name: "CivicPermit API",
  description: "Permit workflow service",
  repo_url: null,
  production_url: null,
  status: "development",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
};

const repo: RepoIntegration = {
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

const completedAnalysis: RepoAnalysis = {
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

const failedAnalysis: RepoAnalysis = {
  ...completedAnalysis,
  id: 13,
  status: "failed",
  summary: "CodeMap Lite analysis failed.",
  detected_stack: {},
  detected_files: [],
  detected_folders: [],
  signals: {},
  error_message: "GitHub tree request failed.",
  total_files_scanned: 0,
};

const healthyCheck: HealthCheck = {
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

const readiness: ProjectReadinessSummary = {
  score: 67,
  status: "in_progress",
  passed: 4,
  failed: 2,
  unknown: 1,
  not_applicable: 0,
  total_applicable: 7,
  top_gaps: ["Add CI evidence."],
  items: [
    {
      id: 31,
      project_id: 7,
      readiness_item_id: 4,
      item: {
        id: 4,
        key: "secrets_management_reviewed",
        label: "Secrets management reviewed",
        description: "Confirm secrets are managed outside source control.",
        category: "operations",
        evaluation_type: "manual",
        sort_order: 4,
        is_active: true,
      },
      status: "unknown",
      source: "manual",
      evidence: null,
      notes: null,
      evaluated_at: "2026-01-05T00:00:00Z",
    },
  ],
};

const artifact: ProjectArtifact = {
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

const activityEvent: ProjectActivityEvent = {
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

describe("project command-center summaries", () => {
  it("summarizes repository connection states", () => {
    expect(getRepositorySummary(null)).toMatchObject({
      state: "not_connected",
      label: "Not connected",
      title: "No repository connected",
    });

    expect(getRepositorySummary(repo)).toMatchObject({
      state: "connected",
      label: "Connected",
      title: "openai/codex",
      detail: "GitHub repository connected.",
    });
  });

  it("summarizes CodeMap states from repository and latest analysis", () => {
    expect(getCodeMapSummary(null, null)).toMatchObject({ state: "not_ready", label: "Not ready" });
    expect(getCodeMapSummary(repo, null)).toMatchObject({ state: "not_run", label: "Not run" });
    expect(getCodeMapSummary(repo, completedAnalysis)).toMatchObject({
      state: "completed",
      label: "Completed",
      metric: "42 files",
    });
    expect(getCodeMapSummary(repo, failedAnalysis)).toMatchObject({
      state: "failed",
      label: "Failed",
      detail: "GitHub tree request failed.",
    });
  });

  it.each([
    { check: null, state: "no_checks", label: "Not checked" },
    { check: healthyCheck, state: "healthy", label: "Healthy" },
    { check: { ...healthyCheck, status: "unhealthy" as const, http_status_code: 500 }, state: "unhealthy", label: "Unhealthy" },
    { check: { ...healthyCheck, status: "timeout" as const, http_status_code: null }, state: "timeout", label: "Timeout" },
    { check: { ...healthyCheck, status: "error" as const, http_status_code: null }, state: "error", label: "Error" },
  ])("summarizes Health state $state", ({ check, state, label }) => {
    const withUrl = { ...project, production_url: "https://civicpermit.example.com/health" };
    expect(getHealthSummary(withUrl, check)).toMatchObject({ state, label });
  });

  it("summarizes missing health target before health-check state", () => {
    expect(getHealthSummary(project, healthyCheck)).toMatchObject({
      state: "no_target",
      label: "No target",
      title: "No production URL",
    });
  });

  it("summarizes readiness before and after evaluation", () => {
    expect(getReadinessSummary(null)).toMatchObject({
      state: "not_evaluated",
      label: "Not evaluated",
      scoreLabel: "No score yet",
    });

    expect(getReadinessSummary(readiness)).toMatchObject({
      state: "in_progress",
      label: "In progress",
      scoreLabel: "67/100",
      topGap: "Add CI evidence.",
    });
  });

  it("treats malformed readiness payloads as not evaluated instead of crashing the dashboard", () => {
    expect(getReadinessSummary([] as unknown as ProjectReadinessSummary)).toMatchObject({
      state: "not_evaluated",
      label: "Not evaluated",
    });
  });

  it("summarizes artifacts without implying document analysis", () => {
    expect(getArtifactsSummary([])).toMatchObject({
      state: "empty",
      label: "No artifacts",
      title: "No artifacts registered",
      targetId: "artifacts",
    });

    expect(getArtifactsSummary([artifact, { ...artifact, id: 42, status: "archived" }])).toMatchObject({
      state: "registered",
      label: "1 active",
      title: "1 active artifact",
      metric: "1 archived",
      timestamp: "2026-01-06T00:00:00Z",
    });

    expect(
      getArtifactsSummary([
        artifact,
        {
          ...artifact,
          id: 43,
          title: "Archived incident review",
          status: "archived",
          updated_at: "2026-01-07T00:00:00Z",
        },
      ]),
    ).toMatchObject({
      detail: "Most recent: Deployment runbook",
      timestamp: "2026-01-06T00:00:00Z",
    });
  });

  it("summarizes recent activity without implying notifications", () => {
    expect(getActivitySummary([])).toMatchObject({
      state: "empty",
      label: "No events",
      title: "No activity recorded yet",
      targetId: "activity",
    });

    expect(getActivitySummary([activityEvent])).toMatchObject({
      state: "recorded",
      label: "1 event",
      title: "Latest activity",
      detail: "Artifact was created.",
      timestamp: "2026-01-07T12:00:00Z",
      targetId: "activity",
    });
  });
});

describe("project setup progress and next actions", () => {
  it("builds setup steps with complete and incomplete states", () => {
    const steps = getProjectSetupSteps({
      project,
      repo,
      latestAnalysis: completedAnalysis,
      latestHealthCheck: null,
      readiness,
      artifacts: [],
    });

    expect(steps.map((step) => [step.id, step.status])).toEqual([
      ["project-created", "complete"],
      ["repository-connected", "complete"],
      ["codemap-run", "complete"],
      ["production-url-added", "incomplete"],
      ["health-check-run", "incomplete"],
      ["readiness-evaluated", "complete"],
      ["artifacts-registered", "incomplete"],
      ["manual-readiness-reviewed", "needs_attention"],
    ]);
  });

  it("prioritizes missing repository before other next actions", () => {
    expect(
      getProjectNextActions({
        project,
        repo: null,
        latestAnalysis: null,
        latestHealthCheck: null,
        readiness: null,
        artifacts: [],
      })[0],
    ).toMatchObject({
      title: "Attach a GitHub repository.",
      targetId: "repository",
    });
  });

  it("prioritizes CodeMap after repository connection", () => {
    expect(
      getProjectNextActions({
        project,
        repo,
        latestAnalysis: null,
        latestHealthCheck: null,
        readiness: null,
        artifacts: [],
      })[0],
    ).toMatchObject({
      title: "Run CodeMap Lite analysis.",
      targetId: "codemap",
    });
  });

  it("prioritizes production URL and health check from actual project state", () => {
    const withUrl = { ...project, production_url: "https://civicpermit.example.com/health" };

    expect(
      getProjectNextActions({
        project,
        repo,
        latestAnalysis: completedAnalysis,
        latestHealthCheck: null,
        readiness: null,
        artifacts: [],
      })[0],
    ).toMatchObject({ title: "Add a production URL.", targetId: "details" });

    expect(
      getProjectNextActions({
        project: withUrl,
        repo,
        latestAnalysis: completedAnalysis,
        latestHealthCheck: null,
        readiness: null,
        artifacts: [],
      })[0],
    ).toMatchObject({ title: "Run a manual health check.", targetId: "health" });
  });

  it("surfaces readiness top gaps and manual review work after evaluation", () => {
    const actions = getProjectNextActions({
      project: { ...project, production_url: "https://civicpermit.example.com/health" },
      repo,
      latestAnalysis: completedAnalysis,
      latestHealthCheck: healthyCheck,
      readiness,
      artifacts: [artifact],
    });

    expect(actions.map((action) => action.title)).toEqual([
      "Review readiness gap: Add CI evidence.",
      "Complete manual readiness review items.",
      "Link artifacts to readiness evidence.",
    ]);
  });

  it("adds artifact registration as a low-priority next action", () => {
    const actions = getProjectNextActions({
      project: { ...project, production_url: "https://civicpermit.example.com/health" },
      repo,
      latestAnalysis: completedAnalysis,
      latestHealthCheck: healthyCheck,
      readiness: { ...readiness, top_gaps: [], items: [] },
      artifacts: [],
    });

    expect(actions.at(-1)).toMatchObject({
      title: "Add a project note or runbook.",
      targetId: "artifacts",
    });
  });

  it("recommends linking artifacts after higher-priority readiness review work", () => {
    const actions = getProjectNextActions({
      project: { ...project, production_url: "https://civicpermit.example.com/health" },
      repo,
      latestAnalysis: completedAnalysis,
      latestHealthCheck: healthyCheck,
      readiness: { ...readiness, top_gaps: [] },
      artifacts: [artifact],
    });

    expect(actions.map((action) => action.title)).toEqual([
      "Complete manual readiness review items.",
      "Link artifacts to readiness evidence.",
    ]);
    expect(actions.at(-1)).toMatchObject({
      targetId: "readiness",
      priority: 75,
    });
  });
});
