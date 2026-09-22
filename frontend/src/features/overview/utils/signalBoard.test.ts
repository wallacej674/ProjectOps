import {
  summarizeArtifactsSignal,
  summarizeCiStatusSignal,
  summarizeHealthSignal,
  summarizeReadinessSignal,
  summarizeRepoAnalysisSignal,
} from "./signalBoard";
import type { ProjectCiStatusSummary } from "../../../types/ciPipelineRun";
import type { ProjectHealthSummary } from "../../../types/healthCheck";
import type { ProjectReadinessOverview } from "../../../types/readiness";
import type { ProjectRepoAnalysisOverview } from "../../../types/repoAnalysis";
import type { ProjectArtifactOverview } from "../../../types/projectArtifact";

function healthRow(overrides: Partial<ProjectHealthSummary> = {}): ProjectHealthSummary {
  return {
    project_id: 1,
    project_name: "Project",
    project_status: "development",
    production_url: "https://example.com",
    latest_check: {
      id: 1,
      project_id: 1,
      target_url: "https://example.com",
      status: "healthy",
      http_status_code: 200,
      response_time_ms: 100,
      checked_at: "2026-01-01T00:00:00Z",
      error_message: null,
      response_preview: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    ...overrides,
  };
}

describe("summarizeHealthSignal", () => {
  it("buckets healthy, down, and unchecked projects", () => {
    const rows = [
      healthRow(),
      healthRow({ latest_check: { ...healthRow().latest_check!, status: "unhealthy" } }),
      healthRow({ production_url: null, latest_check: null }),
    ];
    expect(summarizeHealthSignal(rows)).toEqual({
      total: 3,
      buckets: [
        { label: "healthy", tone: "success", count: 1 },
        { label: "needs attention", tone: "danger", count: 1 },
        { label: "unchecked", tone: "neutral", count: 1 },
      ],
    });
  });

  it("treats a project with a target but no check yet as unchecked, not down", () => {
    const rows = [healthRow({ latest_check: null })];
    expect(summarizeHealthSignal(rows).buckets).toContainEqual({ label: "unchecked", tone: "neutral", count: 1 });
  });
});

describe("summarizeReadinessSignal", () => {
  it("buckets by readiness status", () => {
    const rows: ProjectReadinessOverview[] = [
      { project_id: 1, project_name: "A", project_status: "development", score: 90, status: "strong", passed: 9, failed: 0, unknown: 1, not_applicable: 0, total_applicable: 10, top_gaps: [] },
      { project_id: 2, project_name: "B", project_status: "development", score: 40, status: "needs_work", passed: 4, failed: 6, unknown: 0, not_applicable: 0, total_applicable: 10, top_gaps: [] },
      { project_id: 3, project_name: "C", project_status: "development", score: 60, status: "in_progress", passed: 6, failed: 1, unknown: 3, not_applicable: 0, total_applicable: 10, top_gaps: [] },
      { project_id: 4, project_name: "D", project_status: "development", score: null, status: "not_started", passed: 0, failed: 0, unknown: 0, not_applicable: 0, total_applicable: 0, top_gaps: [] },
    ];
    expect(summarizeReadinessSignal(rows)).toEqual({
      total: 4,
      buckets: [
        { label: "strong", tone: "success", count: 1 },
        { label: "in progress", tone: "warning", count: 1 },
        { label: "needs work", tone: "danger", count: 1 },
        { label: "not evaluated", tone: "neutral", count: 1 },
      ],
    });
  });
});

describe("summarizeRepoAnalysisSignal", () => {
  it("buckets by latest analysis status", () => {
    const rows: ProjectRepoAnalysisOverview[] = [
      { project_id: 1, project_name: "A", project_status: "development", repo_owner: "o", repo_name: "r", latest_status: "completed", summary: null, total_files_scanned: 10, analyzed_at: "2026-01-01T00:00:00Z" },
      { project_id: 2, project_name: "B", project_status: "development", repo_owner: "o", repo_name: "r", latest_status: "failed", summary: null, total_files_scanned: 0, analyzed_at: "2026-01-01T00:00:00Z" },
      { project_id: 3, project_name: "C", project_status: "development", repo_owner: null, repo_name: null, latest_status: null, summary: null, total_files_scanned: null, analyzed_at: null },
    ];
    expect(summarizeRepoAnalysisSignal(rows)).toEqual({
      total: 3,
      buckets: [
        { label: "completed", tone: "success", count: 1 },
        { label: "failed", tone: "danger", count: 1 },
        { label: "not connected", tone: "neutral", count: 1 },
      ],
    });
  });
});

describe("summarizeCiStatusSignal", () => {
  it("buckets passing, failing, not-connected, and unchecked projects", () => {
    const baseMonitor = {
      project_id: 1, enabled: false, cadence_minutes: 60 as const, next_run_at: null,
      last_started_at: null, last_completed_at: null, last_outcome: null,
      consecutive_sync_failures: 0, created_at: null, updated_at: null,
    };
    const baseRun = {
      id: 1, project_id: 1, repo_integration_id: 1, github_run_id: 1, github_workflow_id: null,
      workflow_name: "CI", run_number: 1, status: "completed", branch: "main", commit_sha: null,
      commit_message: null, event: "push", html_url: null, run_started_at: null,
      run_completed_at: null, duration_seconds: null, observed_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };
    const rows: ProjectCiStatusSummary[] = [
      { project_id: 1, project_name: "A", project_status: "development", repo_owner: "o", repo_name: "r", ci_available: true, needs_reauthorization: false, latest_run: { ...baseRun, conclusion: "success" }, monitor: baseMonitor },
      { project_id: 2, project_name: "B", project_status: "development", repo_owner: "o", repo_name: "r", ci_available: true, needs_reauthorization: false, latest_run: { ...baseRun, conclusion: "failure" }, monitor: baseMonitor },
      { project_id: 3, project_name: "C", project_status: "development", repo_owner: null, repo_name: null, ci_available: false, needs_reauthorization: false, latest_run: null, monitor: baseMonitor },
      { project_id: 4, project_name: "D", project_status: "development", repo_owner: "o", repo_name: "r", ci_available: true, needs_reauthorization: false, latest_run: null, monitor: baseMonitor },
    ];
    expect(summarizeCiStatusSignal(rows)).toEqual({
      total: 4,
      buckets: [
        { label: "passing", tone: "success", count: 1 },
        { label: "failing", tone: "danger", count: 1 },
        { label: "not connected", tone: "neutral", count: 1 },
        { label: "unchecked", tone: "neutral", count: 1 },
      ],
    });
  });

  it("buckets a needs-reauthorization project as failing", () => {
    const rows: ProjectCiStatusSummary[] = [{
      project_id: 1, project_name: "A", project_status: "development", repo_owner: "o", repo_name: "r",
      ci_available: true, needs_reauthorization: true, latest_run: null,
      monitor: { project_id: 1, enabled: true, cadence_minutes: 60, next_run_at: null, last_started_at: null,
        last_completed_at: null, last_outcome: "permission_missing", consecutive_sync_failures: 1, created_at: null, updated_at: null },
    }];
    expect(summarizeCiStatusSignal(rows).buckets).toContainEqual({ label: "failing", tone: "danger", count: 1 });
  });
});

describe("summarizeArtifactsSignal", () => {
  it("buckets projects with and without active artifacts", () => {
    const rows: ProjectArtifactOverview[] = [
      { project_id: 1, project_name: "A", project_status: "development", active_artifact_count: 2, most_recent_title: "Note", most_recent_updated_at: "2026-01-01T00:00:00Z" },
      { project_id: 2, project_name: "B", project_status: "development", active_artifact_count: 0, most_recent_title: null, most_recent_updated_at: null },
    ];
    expect(summarizeArtifactsSignal(rows)).toEqual({
      total: 2,
      buckets: [
        { label: "with artifacts", tone: "success", count: 1 },
        { label: "empty", tone: "neutral", count: 1 },
      ],
    });
  });
});
