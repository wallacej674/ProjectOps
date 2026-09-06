import type { ProjectHealthSummary } from "../../../types/healthCheck";
import { makeProject } from "../../../test/mockApi";
import { buildProjectOperationalSnapshots } from "../../projects/utils/projectPortfolio";
import { buildOverviewPortfolio } from "./overviewPortfolio";

function health(projectId: number, status: "healthy" | "unhealthy" = "healthy"): ProjectHealthSummary {
  return {
    project_id: projectId,
    project_name: `Project ${projectId}`,
    project_status: "production",
    production_url: "https://example.com",
    latest_check: {
      id: projectId,
      project_id: projectId,
      target_url: "https://example.com",
      status,
      http_status_code: status === "healthy" ? 200 : 500,
      response_time_ms: 100,
      checked_at: "2026-01-03T00:00:00Z",
      error_message: null,
      response_preview: null,
      created_at: "2026-01-03T00:00:00Z",
    },
  };
}

describe("buildOverviewPortfolio", () => {
  it("prioritizes unhealthy production ahead of setup warnings", () => {
    const projects = [
      makeProject({ id: 1, name: "Unhealthy", repo_url: "https://github.com/a/b", production_url: "https://a.test" }),
      makeProject({ id: 2, name: "Missing repo", production_url: "https://b.test" }),
      makeProject({ id: 3, name: "Healthy", repo_url: "https://github.com/a/c", production_url: "https://c.test" }),
    ];
    const healthRows = [health(1, "unhealthy"), health(3)];
    const snapshots = buildProjectOperationalSnapshots(projects, healthRows, []);

    const model = buildOverviewPortfolio(projects, snapshots, healthRows, [], [], [], []);

    expect(model).toMatchObject({
      activeCount: 3,
      healthyCount: 1,
      needsAttentionCount: 2,
      missingSetupCount: 1,
      criticalCount: 0,
    });
    expect(model.attentionItems.map((item) => item.projectName)).toEqual(["Unhealthy", "Missing repo"]);
    expect(model.attentionItems[0]).toMatchObject({ severity: "warning", actionLabel: "Review health" });
  });

  it("uses recent activity to order the compact project list", () => {
    const projects = [
      makeProject({ id: 1, name: "Older", repo_url: "repo", production_url: "https://a.test", updated_at: "2026-01-01T00:00:00Z" }),
      makeProject({ id: 2, name: "Recent", repo_url: "repo", production_url: "https://b.test", updated_at: "2026-01-02T00:00:00Z" }),
    ];
    const healthRows = [health(1), health(2)];
    const snapshots = buildProjectOperationalSnapshots(projects, healthRows, []);
    const events = [
      {
        id: 1,
        project_id: 2,
        project_name: "Recent",
        project_status: "development",
        event_type: "project_updated" as const,
        event_category: "project" as const,
        message: "Project details were updated.",
        related_resource_type: "project",
        related_resource_id: 2,
        metadata: null,
        created_at: "2026-01-04T00:00:00Z",
      },
    ];

    const model = buildOverviewPortfolio(projects, snapshots, healthRows, [], [], [], events);

    expect(model.recentProjects.map((row) => row.project.name)).toEqual(["Recent", "Older"]);
  });
});
