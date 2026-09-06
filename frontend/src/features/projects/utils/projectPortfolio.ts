import { productionCheck } from "../../health/productionHealth";
import type { ProjectHealthSummary } from "../../../types/healthCheck";
import type { Project } from "../../../types/project";
import type { ProjectReadinessOverview } from "../../../types/readiness";
import type { CommandCenterTone } from "./projectCommandCenter";

export type ProjectRegistrySegment = "all" | "attention" | "healthy" | "missing_setup" | "archived";

export interface ProjectOperationalSnapshot {
  healthLabel: string;
  healthTone: CommandCenterTone;
  readinessLabel: string;
  readinessTone: CommandCenterTone;
  missingSetup: boolean;
  needsAttention: boolean;
}

export interface ProjectPortfolioSummary {
  total: number;
  active: number;
  needsAttention: number;
  healthy: number;
  missingSetup: number;
  archived: number;
}

function healthReading(row?: ProjectHealthSummary) {
  const status = productionCheck(row)?.status;
  if (row?.monitor?.active_alert) return { label: row.monitor.active_alert.acknowledged_at ? "Acknowledged alert" : "Active alert", tone: "danger" as const };
  if (row?.monitor?.freshness === "overdue") return { label: "Monitoring overdue", tone: "warning" as const };
  if (!row?.production_url) return { label: "No target", tone: "neutral" as const };
  if (!status) return { label: "Not checked", tone: "warning" as const };
  if (status === "healthy") return { label: "Healthy", tone: "success" as const };
  if (status === "unhealthy") return { label: "Unhealthy", tone: "danger" as const };
  return { label: status === "timeout" ? "Timeout" : "Error", tone: "warning" as const };
}

function readinessReading(row?: ProjectReadinessOverview) {
  if (!row || row.status === "not_started" || row.score === null) {
    return { label: "Not evaluated", tone: "neutral" as const };
  }
  return {
    label: `${row.score}/100`,
    tone: row.status === "strong" ? ("success" as const) : row.status === "needs_work" ? ("danger" as const) : ("warning" as const),
  };
}

export function getProjectOperationalSnapshot(
  project: Project,
  health?: ProjectHealthSummary,
  readiness?: ProjectReadinessOverview,
): ProjectOperationalSnapshot {
  const healthResult = healthReading(health);
  const readinessResult = readinessReading(readiness);
  const missingSetup = !project.repo_url || !project.production_url;
  const healthNeedsAttention = Boolean(project.production_url && healthResult.label !== "Healthy");
  const readinessNeedsAttention = readiness?.status === "needs_work";

  return {
    healthLabel: healthResult.label,
    healthTone: healthResult.tone,
    readinessLabel: readinessResult.label,
    readinessTone: readinessResult.tone,
    missingSetup,
    needsAttention: project.status !== "archived" && (missingSetup || healthNeedsAttention || readinessNeedsAttention),
  };
}

export function buildProjectOperationalSnapshots(
  projects: Project[],
  healthRows: ProjectHealthSummary[],
  readinessRows: ProjectReadinessOverview[],
) {
  const healthByProject = new Map(healthRows.map((row) => [row.project_id, row]));
  const readinessByProject = new Map(readinessRows.map((row) => [row.project_id, row]));

  return new Map(
    projects.map((project) => [
      project.id,
      getProjectOperationalSnapshot(project, healthByProject.get(project.id), readinessByProject.get(project.id)),
    ]),
  );
}

export function summarizeProjectPortfolio(
  projects: Project[],
  snapshots: Map<number, ProjectOperationalSnapshot>,
): ProjectPortfolioSummary {
  const active = projects.filter((project) => project.status !== "archived");
  return {
    total: projects.length,
    active: active.length,
    needsAttention: active.filter((project) => snapshots.get(project.id)?.needsAttention).length,
    healthy: active.filter((project) => snapshots.get(project.id)?.healthLabel === "Healthy").length,
    missingSetup: active.filter((project) => snapshots.get(project.id)?.missingSetup).length,
    archived: projects.length - active.length,
  };
}

export function matchesProjectSegment(
  project: Project,
  snapshot: ProjectOperationalSnapshot,
  segment: ProjectRegistrySegment,
) {
  if (segment === "archived") return project.status === "archived";
  if (project.status === "archived") return false;
  if (segment === "attention") return snapshot.needsAttention;
  if (segment === "healthy") return snapshot.healthLabel === "Healthy";
  if (segment === "missing_setup") return snapshot.missingSetup;
  return true;
}
