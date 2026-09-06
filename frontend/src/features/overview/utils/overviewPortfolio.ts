import { productionCheck } from "../../health/productionHealth";
import type { ProjectHealthSummary } from "../../../types/healthCheck";
import type { Project } from "../../../types/project";
import type { ProjectArtifactOverview } from "../../../types/projectArtifact";
import type { CrossProjectActivityEvent } from "../../../types/projectActivity";
import type { ProjectReadinessOverview } from "../../../types/readiness";
import type { ProjectRepoAnalysisOverview } from "../../../types/repoAnalysis";
import type { ProjectOperationalSnapshot } from "../../projects/utils/projectPortfolio";

export type AttentionSeverity = "critical" | "warning";

export interface AttentionItem {
  projectId: number;
  projectName: string;
  reason: string;
  severity: AttentionSeverity;
  actionLabel: string;
  to: string;
  updatedAt: string;
  priority?: number;
}

export interface OverviewProjectRow {
  project: Project;
  snapshot: ProjectOperationalSnapshot;
  repositoryLabel: string;
  artifactLabel: string;
  latestActivity: CrossProjectActivityEvent | null;
}

export interface OverviewPortfolioModel {
  activeCount: number;
  healthyCount: number;
  needsAttentionCount: number;
  missingSetupCount: number;
  criticalCount: number;
  attentionItems: AttentionItem[];
  recentProjects: OverviewProjectRow[];
}

function attentionForProject(
  project: Project,
  health: ProjectHealthSummary | undefined,
  readiness: ProjectReadinessOverview | undefined,
  repository: ProjectRepoAnalysisOverview | undefined,
): AttentionItem | null {
  const healthStatus = productionCheck(health)?.status;
  const base = { projectId: project.id, projectName: project.name, updatedAt: project.updated_at };

  if (health?.monitor?.active_alert) {
    const alert = health.monitor.active_alert;
    const secondary = !health.monitor.enabled ? " Monitoring paused; recovery unconfirmed." : health.monitor.freshness === "overdue" ? " Monitoring overdue." : "";
    return { ...base, priority: 0, severity: "critical", reason: `Scheduled checks are failing.${alert.acknowledged_at ? " Acknowledged." : ""}${secondary}`,
      actionLabel: "Review alert", to: `/app/projects/${project.id}#health`, updatedAt: alert.last_observed_at };
  }
  if (health?.monitor?.freshness === "overdue") return { ...base, priority: 1, severity: "warning", reason: "Monitoring overdue; endpoint health unconfirmed.",
    actionLabel: "Review monitoring", to: `/app/projects/${project.id}#health` };
  if (healthStatus && healthStatus !== "healthy") {
    return {
      ...base,
      priority: 2,
      severity: "warning",
      reason: `Latest production check is ${healthStatus}.`,
      actionLabel: "Review health",
      to: `/app/projects/${project.id}#health`,
    };
  }
  if (!project.repo_url) {
    return {
      ...base,
      severity: "warning",
      reason: "Repository is not connected.",
      actionLabel: "Connect repository",
      to: `/app/projects/${project.id}#repository`,
    };
  }
  if (!project.production_url) {
    return {
      ...base,
      severity: "warning",
      reason: "Production target is missing.",
      actionLabel: "Add production target",
      to: `/app/projects/${project.id}/edit`,
    };
  }
  if (!healthStatus) {
    return {
      ...base,
      severity: "warning",
      reason: "Production health has not been checked.",
      actionLabel: "Run health check",
      to: `/app/projects/${project.id}#health`,
    };
  }
  if (repository?.latest_status === "failed") {
    return {
      ...base,
      severity: "warning",
      reason: "Repository analysis failed.",
      actionLabel: "Review analysis",
      to: `/app/projects/${project.id}#codemap`,
    };
  }
  if (readiness?.status === "needs_work") {
    return {
      ...base,
      severity: "warning",
      reason: "Readiness review needs work.",
      actionLabel: "Review readiness",
      to: `/app/projects/${project.id}#readiness`,
    };
  }
  return null;
}

function latestActivityByProject(events: CrossProjectActivityEvent[]) {
  const latest = new Map<number, CrossProjectActivityEvent>();
  events.forEach((event) => {
    const current = latest.get(event.project_id);
    if (!current || Date.parse(event.created_at) > Date.parse(current.created_at)) latest.set(event.project_id, event);
  });
  return latest;
}

/** Builds the portfolio state used by every Overview surface from one consistent set of rules. */
export function buildOverviewPortfolio(
  projects: Project[],
  snapshots: Map<number, ProjectOperationalSnapshot>,
  healthRows: ProjectHealthSummary[],
  readinessRows: ProjectReadinessOverview[],
  repoRows: ProjectRepoAnalysisOverview[],
  artifactRows: ProjectArtifactOverview[],
  activityEvents: CrossProjectActivityEvent[],
): OverviewPortfolioModel {
  const healthByProject = new Map(healthRows.map((row) => [row.project_id, row]));
  const readinessByProject = new Map(readinessRows.map((row) => [row.project_id, row]));
  const repoByProject = new Map(repoRows.map((row) => [row.project_id, row]));
  const artifactsByProject = new Map(artifactRows.map((row) => [row.project_id, row]));
  const activityByProject = latestActivityByProject(activityEvents);
  const active = projects.filter((project) => project.status !== "archived");

  const rows = active.map<OverviewProjectRow>((project) => {
    const repository = repoByProject.get(project.id);
    const artifacts = artifactsByProject.get(project.id);
    return {
      project,
      snapshot: snapshots.get(project.id)!,
      repositoryLabel:
        repository?.latest_status === "completed"
          ? "Analyzed"
          : repository?.latest_status === "failed"
            ? "Analysis failed"
            : project.repo_url
              ? "Connected"
              : "Not connected",
      artifactLabel: artifacts?.active_artifact_count
        ? `${artifacts.active_artifact_count} artifact${artifacts.active_artifact_count === 1 ? "" : "s"}`
        : "No artifacts",
      latestActivity: activityByProject.get(project.id) ?? null,
    };
  });

  const attentionItems = active
    .map((project) =>
      attentionForProject(
        project,
        healthByProject.get(project.id),
        readinessByProject.get(project.id),
        repoByProject.get(project.id),
      ),
    )
    .filter((item): item is AttentionItem => Boolean(item))
    .sort((a, b) => {
      if ((a.priority ?? 3) !== (b.priority ?? 3)) return (a.priority ?? 3) - (b.priority ?? 3);
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

  const recentProjects = [...rows]
    .sort((a, b) => {
      const aDate = a.latestActivity?.created_at ?? a.project.updated_at;
      const bDate = b.latestActivity?.created_at ?? b.project.updated_at;
      return Date.parse(bDate) - Date.parse(aDate);
    })
    .slice(0, 5);

  return {
    activeCount: active.length,
    healthyCount: rows.filter((row) => row.snapshot.healthLabel === "Healthy").length,
    needsAttentionCount: attentionItems.length,
    missingSetupCount: active.filter((project) => !project.repo_url || !project.production_url).length,
    criticalCount: attentionItems.filter((item) => item.severity === "critical").length,
    attentionItems,
    recentProjects,
  };
}
