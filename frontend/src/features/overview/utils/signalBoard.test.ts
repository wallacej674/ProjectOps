import {
  summarizeArtifactsSignal,
  summarizeHealthSignal,
  summarizeReadinessSignal,
  summarizeRepoAnalysisSignal,
} from "./signalBoard";
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
