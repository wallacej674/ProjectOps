import { describe, expect, it } from "vitest";
import type { ProjectHealthSummary } from "../../../types/healthCheck";
import type { ProjectReadinessOverview } from "../../../types/readiness";
import { makeProject } from "../../../test/mockApi";
import {
  buildProjectOperationalSnapshots,
  getProjectOperationalSnapshot,
  matchesProjectSegment,
  summarizeProjectPortfolio,
} from "./projectPortfolio";

const healthy: ProjectHealthSummary = {
  project_id: 1,
  project_name: "Healthy API",
  project_status: "production",
  production_url: "https://healthy.example.com",
  latest_check: {
    id: 11,
    project_id: 1,
    target_url: "https://healthy.example.com",
    status: "healthy",
    http_status_code: 200,
    response_time_ms: 120,
    checked_at: "2026-08-01T12:00:00Z",
    error_message: null,
    response_preview: null,
    created_at: "2026-08-01T12:00:00Z",
  },
};

const strongReadiness: ProjectReadinessOverview = {
  project_id: 1,
  project_name: "Healthy API",
  project_status: "production",
  score: 92,
  status: "strong",
  passed: 9,
  failed: 0,
  unknown: 1,
  not_applicable: 0,
  total_applicable: 10,
  top_gaps: [],
};

describe("project portfolio signals", () => {
  it("derives real health and readiness readings", () => {
    const project = makeProject({
      id: 1,
      status: "production",
      repo_url: "https://github.com/example/healthy",
      production_url: "https://healthy.example.com",
    });

    expect(getProjectOperationalSnapshot(project, healthy, strongReadiness)).toEqual({
      healthLabel: "Healthy",
      healthTone: "success",
      readinessLabel: "92/100",
      readinessTone: "success",
      missingSetup: false,
      needsAttention: false,
    });
  });

  it("marks missing setup and unchecked production targets for attention", () => {
    const missing = makeProject({ id: 2, repo_url: null, production_url: null });
    const unchecked = makeProject({
      id: 3,
      repo_url: "https://github.com/example/api",
      production_url: "https://api.example.com",
    });

    expect(getProjectOperationalSnapshot(missing)).toMatchObject({ missingSetup: true, needsAttention: true });
    expect(
      getProjectOperationalSnapshot(unchecked, {
        project_id: 3,
        project_name: "API",
        project_status: "development",
        production_url: "https://api.example.com",
        latest_check: null,
      }),
    ).toMatchObject({ healthLabel: "Not checked", needsAttention: true });
  });

  it("summarizes active Projects and supports operational segments", () => {
    const activeHealthy = makeProject({
      id: 1,
      status: "production",
      repo_url: "https://github.com/example/healthy",
      production_url: "https://healthy.example.com",
    });
    const missing = makeProject({ id: 2, name: "Needs setup" });
    const archived = makeProject({ id: 3, status: "archived" });
    const projects = [activeHealthy, missing, archived];
    const snapshots = buildProjectOperationalSnapshots(projects, [healthy], [strongReadiness]);

    expect(summarizeProjectPortfolio(projects, snapshots)).toEqual({
      total: 3,
      active: 2,
      needsAttention: 1,
      healthy: 1,
      missingSetup: 1,
      archived: 1,
    });
    expect(matchesProjectSegment(activeHealthy, snapshots.get(1)!, "healthy")).toBe(true);
    expect(matchesProjectSegment(missing, snapshots.get(2)!, "attention")).toBe(true);
    expect(matchesProjectSegment(archived, snapshots.get(3)!, "archived")).toBe(true);
    expect(matchesProjectSegment(archived, snapshots.get(3)!, "all")).toBe(false);
  });
});
