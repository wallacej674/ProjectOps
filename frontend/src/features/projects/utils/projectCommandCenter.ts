import type { HealthMonitorSchedule } from "../../../types/healthCheck";
import type { HealthCheck, HealthCheckStatus } from "../../../types/healthCheck";
import type { Project } from "../../../types/project";
import type { ProjectActivityEvent } from "../../../types/projectActivity";
import type { ProjectArtifact } from "../../../types/projectArtifact";
import type { ProjectReadinessItem, ProjectReadinessSummary } from "../../../types/readiness";
import type { RepoAnalysis } from "../../../types/repoAnalysis";
import type { RepoIntegration } from "../../../types/repoIntegration";
import {
  getLaunchDecisionNotes,
  getLaunchDecisionValue,
  launchDecisionLabels,
} from "./launchDecisionArtifacts";

export type CommandCenterTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface CommandCenterSummary {
  state: string;
  label: string;
  title: string;
  detail: string;
  metric?: string;
  timestamp?: string;
  tone: CommandCenterTone;
  targetId: ProjectSectionId;
}

export type ProjectSectionId =
  | "overview"
  | "repository"
  | "codemap"
  | "health"
  | "readiness"
  | "launch-report"
  | "launch-decision"
  | "artifacts"
  | "activity"
  | "details";

export interface ProjectSetupStep {
  id: string;
  label: string;
  status: "complete" | "incomplete" | "needs_attention";
  detail: string;
  targetId: ProjectSectionId;
}

export interface ProjectNextAction {
  id: string;
  title: string;
  detail: string;
  targetId: ProjectSectionId;
  priority: number;
}

export interface ProjectCommandCenterInput {
  project: Project;
  repo: RepoIntegration | null;
  latestAnalysis: RepoAnalysis | null;
  latestHealthCheck: HealthCheck | null;
  readiness: ProjectReadinessSummary | null;
  artifacts?: ProjectArtifact[];
  activityEvents?: ProjectActivityEvent[];
  latestLaunchDecision?: ProjectArtifact | null;
}

const readinessLabels: Record<string, string> = {
  not_started: "Not evaluated",
  needs_work: "Needs work",
  in_progress: "In progress",
  strong: "Strong evidence",
};

const healthLabels: Record<HealthCheckStatus, string> = {
  healthy: "Healthy",
  unhealthy: "Unhealthy",
  timeout: "Timeout",
  error: "Error",
};

const healthTones: Record<HealthCheckStatus, CommandCenterTone> = {
  healthy: "success",
  unhealthy: "danger",
  timeout: "warning",
  error: "warning",
};

function providerLabel(provider?: string | null) {
  if (!provider) return "Repository";
  return provider === "github" ? "GitHub" : provider;
}

function readinessLabel(status?: string | null) {
  if (!status) return "Not evaluated";
  return readinessLabels[status] || status.replaceAll("_", " ");
}

function manualReadinessItems(readiness: ProjectReadinessSummary | null): ProjectReadinessItem[] {
  if (!readiness || !Array.isArray(readiness.items)) return [];
  return readiness.items.filter((item) => item.item.evaluation_type === "manual");
}

function hasUnknownManualReadiness(readiness: ProjectReadinessSummary | null) {
  return manualReadinessItems(readiness).some((item) => item.status === "unknown");
}

function hasReadinessStatus(readiness: ProjectReadinessSummary | null): readiness is ProjectReadinessSummary {
  return Boolean(readiness && "status" in readiness && readiness.status);
}

export function getRepositorySummary(repo: RepoIntegration | null): CommandCenterSummary {
  if (!repo) {
    return {
      state: "not_connected",
      label: "Not connected",
      title: "No repository connected",
      detail: "Attach a public GitHub repository to unlock CodeMap Lite analysis.",
      tone: "warning",
      targetId: "repository",
    };
  }

  return {
    state: "connected",
    label: "Connected",
    title: `${repo.repo_owner}/${repo.repo_name}`,
    detail: `${providerLabel(repo.provider)} repository connected.`,
    metric: repo.default_branch ? `Default branch ${repo.default_branch}` : undefined,
    timestamp: repo.last_verified_at ?? undefined,
    tone: "success",
    targetId: "repository",
  };
}

export function getCodeMapSummary(repo: RepoIntegration | null, latestAnalysis: RepoAnalysis | null): CommandCenterSummary {
  if (!repo) {
    return {
      state: "not_ready",
      label: "Not ready",
      title: "Repository required",
      detail: "Connect a repository before running CodeMap Lite.",
      tone: "neutral",
      targetId: "codemap",
    };
  }

  if (!latestAnalysis) {
    return {
      state: "not_run",
      label: "Not run",
      title: "Ready for analysis",
      detail: "Repository connected, but CodeMap Lite has not run yet.",
      tone: "warning",
      targetId: "codemap",
    };
  }

  if (latestAnalysis.status === "failed") {
    return {
      state: "failed",
      label: "Failed",
      title: "Latest analysis failed",
      detail: latestAnalysis.error_message || latestAnalysis.summary || "CodeMap Lite could not complete the latest run.",
      metric: `${latestAnalysis.total_files_scanned} files`,
      timestamp: latestAnalysis.created_at,
      tone: "danger",
      targetId: "codemap",
    };
  }

  return {
    state: "completed",
    label: "Completed",
    title: "Latest analysis stored",
    detail: latestAnalysis.summary || "CodeMap Lite completed with stored path-based evidence.",
    metric: `${latestAnalysis.total_files_scanned} files`,
    timestamp: latestAnalysis.created_at,
    tone: "success",
    targetId: "codemap",
  };
}

export function getHealthSummary(project: Project, latestHealthCheck: HealthCheck | null, monitor?: HealthMonitorSchedule | null): CommandCenterSummary {
  if (monitor?.active_alert) return {
    state: "active_alert", label: monitor.active_alert.acknowledged_at ? "Acknowledged alert" : "Active alert",
    title: "Scheduled checks are failing", detail: !monitor.enabled ? "Monitoring paused; recovery unconfirmed."
      : monitor.freshness === "overdue" ? "Monitoring overdue; recovery unconfirmed."
      : monitor.consecutive_healthy === 1 ? "Recovery pending: 1 of 2 healthy checks." : "Two healthy scheduled checks are required for recovery.",
    tone: "danger", targetId: "health", timestamp: monitor.active_alert.last_observed_at,
  };
  if (monitor?.freshness === "overdue") return { state: "overdue", label: "Monitoring overdue", title: "Scheduled results are late",
    detail: "Endpoint health is unconfirmed.", tone: "warning", targetId: "health" };
  if (latestHealthCheck?.target_url !== project.production_url) latestHealthCheck = null;
  if (!project.production_url) {
    return {
      state: "no_target",
      label: "No target",
      title: "No production URL",
      detail: "Add a production URL before running manual health checks.",
      tone: "neutral",
      targetId: "health",
    };
  }

  if (!latestHealthCheck) {
    return {
      state: "no_checks",
      label: "Not checked",
      title: "Ready for manual check",
      detail: "Run a manual health check to add operational evidence.",
      tone: "warning",
      targetId: "health",
    };
  }

  return {
    state: latestHealthCheck.status,
    label: healthLabels[latestHealthCheck.status],
    title: `${healthLabels[latestHealthCheck.status]} latest result`,
    detail:
      latestHealthCheck.http_status_code !== null
        ? `HTTP ${latestHealthCheck.http_status_code}`
        : latestHealthCheck.error_message || "No HTTP status returned.",
    metric: latestHealthCheck.response_time_ms !== null ? `${latestHealthCheck.response_time_ms} ms` : undefined,
    timestamp: latestHealthCheck.checked_at,
    tone: healthTones[latestHealthCheck.status],
    targetId: "health",
  };
}

export function getReadinessSummary(readiness: ProjectReadinessSummary | null): CommandCenterSummary & {
  scoreLabel: string;
  topGap?: string;
} {
  if (!hasReadinessStatus(readiness) || readiness.status === "not_started") {
    return {
      state: "not_evaluated",
      label: "Not evaluated",
      title: "No readiness evaluation",
      detail: "Readiness uses available evidence and manual review items.",
      scoreLabel: "No score yet",
      tone: "neutral",
      targetId: "readiness",
    };
  }

  const topGaps = Array.isArray(readiness.top_gaps) ? readiness.top_gaps : [];

  return {
    state: readiness.status,
    label: readinessLabel(readiness.status),
    title: `${readinessLabel(readiness.status)} readiness`,
    detail: `${readiness.passed} passed, ${readiness.failed} failed, ${readiness.unknown} unknown.`,
    scoreLabel: readiness.score === null ? "No score yet" : `${readiness.score}/100`,
    topGap: topGaps[0],
    tone: readiness.status === "strong" ? "success" : readiness.status === "needs_work" ? "danger" : "warning",
    targetId: "readiness",
  };
}

export function getArtifactsSummary(artifacts: ProjectArtifact[] | null | undefined): CommandCenterSummary {
  const safeArtifacts = Array.isArray(artifacts) ? artifacts : [];
  const activeArtifacts = safeArtifacts.filter((artifact) => artifact.status === "active");
  const archivedArtifacts = safeArtifacts.filter((artifact) => artifact.status === "archived");
  const latestArtifact = [...safeArtifacts].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const latestActiveArtifact = [...activeArtifacts].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  if (activeArtifacts.length === 0) {
    return {
      state: "empty",
      label: "No artifacts",
      title: "No artifacts registered",
      detail: "Add notes, links, runbooks, or evidence records for this Project.",
      metric: archivedArtifacts.length > 0 ? `${archivedArtifacts.length} archived` : undefined,
      timestamp: latestArtifact?.updated_at,
      tone: "neutral",
      targetId: "artifacts",
    };
  }

  return {
    state: "registered",
    label: `${activeArtifacts.length} active`,
    title: activeArtifacts.length === 1 ? "1 active artifact" : `${activeArtifacts.length} active artifacts`,
    detail: latestActiveArtifact ? `Most recent: ${latestActiveArtifact.title}` : "Artifact metadata records are registered.",
    metric: archivedArtifacts.length > 0 ? `${archivedArtifacts.length} archived` : undefined,
    timestamp: latestActiveArtifact?.updated_at,
    tone: "info",
    targetId: "artifacts",
  };
}

export function getActivitySummary(activityEvents: ProjectActivityEvent[] | null | undefined): CommandCenterSummary {
  const safeEvents = Array.isArray(activityEvents) ? activityEvents : [];
  const latestEvent = safeEvents[0];

  if (!latestEvent) {
    return {
      state: "empty",
      label: "No events",
      title: "No activity recorded yet",
      detail: "Activity appears as ProjectOps workflows are used.",
      tone: "neutral",
      targetId: "activity",
    };
  }

  return {
    state: "recorded",
    label: safeEvents.length === 1 ? "1 event" : `${safeEvents.length} events`,
    title: "Latest activity",
    detail: latestEvent.message,
    timestamp: latestEvent.created_at,
    tone: "info",
    targetId: "activity",
  };
}

export function getLaunchDecisionSummary(latestLaunchDecision: ProjectArtifact | null | undefined): CommandCenterSummary {
  if (!latestLaunchDecision) {
    return {
      state: "none",
      label: "No decision",
      title: "No launch decision recorded",
      detail: "Record the human go/no-go/defer decision when launch review is complete.",
      tone: "neutral",
      targetId: "launch-decision",
    };
  }

  const decision = getLaunchDecisionValue(latestLaunchDecision);
  if (!decision) {
    return {
      state: "unknown",
      label: "Decision recorded",
      title: latestLaunchDecision.title,
      detail: getLaunchDecisionNotes(latestLaunchDecision) || "A launch decision artifact was recorded.",
      timestamp: latestLaunchDecision.created_at,
      tone: "info",
      targetId: "launch-decision",
    };
  }

  return {
    state: decision,
    label: `${launchDecisionLabels[decision]} recorded`,
    title: `Latest decision: ${launchDecisionLabels[decision]}`,
    detail: getLaunchDecisionNotes(latestLaunchDecision) || "No decision notes have been recorded.",
    timestamp: latestLaunchDecision.created_at,
    tone: decision === "go" ? "success" : decision === "no_go" ? "danger" : "warning",
    targetId: "launch-decision",
  };
}

export function getProjectSetupSteps({
  project,
  repo,
  latestAnalysis,
  latestHealthCheck,
  readiness,
  artifacts,
}: ProjectCommandCenterInput): ProjectSetupStep[] {
  const hasReadinessEvaluation = Boolean(hasReadinessStatus(readiness) && readiness.status !== "not_started");
  const manualItems = manualReadinessItems(readiness);
  const activeArtifactCount = Array.isArray(artifacts)
    ? artifacts.filter((artifact) => artifact.status === "active").length
    : 0;

  const steps: ProjectSetupStep[] = [
    {
      id: "project-created",
      label: "Project created",
      status: "complete",
      detail: "Project metadata is available.",
      targetId: "details",
    },
    {
      id: "repository-connected",
      label: "Repository connected",
      status: repo ? "complete" : "incomplete",
      detail: repo ? `${repo.repo_owner}/${repo.repo_name} is connected.` : "Attach a GitHub repository.",
      targetId: "repository",
    },
    {
      id: "codemap-run",
      label: "CodeMap analysis run",
      status: latestAnalysis ? (latestAnalysis.status === "failed" ? "needs_attention" : "complete") : "incomplete",
      detail: latestAnalysis
        ? `Latest CodeMap Lite status: ${latestAnalysis.status}.`
        : "Run CodeMap Lite after attaching a repository.",
      targetId: "codemap",
    },
    {
      id: "production-url-added",
      label: "Production URL added",
      status: project.production_url ? "complete" : "incomplete",
      detail: project.production_url ? "A production URL is configured." : "Add a production URL when one exists.",
      targetId: "details",
    },
    {
      id: "health-check-run",
      label: "Manual health check run",
      status: latestHealthCheck
        ? latestHealthCheck.status === "healthy"
          ? "complete"
          : "needs_attention"
        : "incomplete",
      detail: latestHealthCheck
        ? `Latest health status: ${healthLabels[latestHealthCheck.status]}.`
        : "Run a manual health check for the production URL.",
      targetId: "health",
    },
    {
      id: "readiness-evaluated",
      label: "Readiness evaluated",
      status: hasReadinessEvaluation ? "complete" : "incomplete",
      detail: hasReadinessEvaluation ? "Advisory readiness has been evaluated." : "Run readiness evaluation.",
      targetId: "readiness",
    },
    {
      id: "artifacts-registered",
      label: "Project artifacts registered",
      status: activeArtifactCount > 0 ? "complete" : "incomplete",
      detail:
        activeArtifactCount > 0
          ? `${activeArtifactCount} active artifact${activeArtifactCount === 1 ? "" : "s"} registered.`
          : "Add notes, links, runbooks, or evidence records.",
      targetId: "artifacts",
    },
  ];

  if (manualItems.length > 0) {
    steps.push({
      id: "manual-readiness-reviewed",
      label: "Manual readiness review completed",
      status: hasUnknownManualReadiness(readiness) ? "needs_attention" : "complete",
      detail: hasUnknownManualReadiness(readiness)
        ? "Some manual readiness items are still unknown."
        : "Manual readiness items have been reviewed.",
      targetId: "readiness",
    });
  }

  return steps;
}

export function getProjectNextActions(input: ProjectCommandCenterInput): ProjectNextAction[] {
  const { project, repo, latestAnalysis, latestHealthCheck, readiness, latestLaunchDecision } = input;
  const actions: ProjectNextAction[] = [];
  const activeArtifactCount = Array.isArray(input.artifacts)
    ? input.artifacts.filter((artifact) => artifact.status === "active").length
    : 0;
  const launchDecision = latestLaunchDecision ? getLaunchDecisionValue(latestLaunchDecision) : null;

  if (launchDecision === "no_go") {
    actions.push({
      id: "review-no-go-launch-decision",
      title: "Review latest No-go launch notes.",
      detail: "The latest human launch decision says the team should not launch yet.",
      targetId: "launch-decision",
      priority: 5,
    });
  } else if (launchDecision === "defer") {
    actions.push({
      id: "review-deferred-launch-decision",
      title: "Review deferred launch context.",
      detail: "The latest human launch decision deferred launch until more context is available.",
      targetId: "launch-decision",
      priority: 6,
    });
  }

  if (!repo) {
    actions.push({
      id: "attach-repository",
      title: "Attach a GitHub repository.",
      detail: "Repository connection is the first step before CodeMap Lite analysis.",
      targetId: "repository",
      priority: 10,
    });
  } else if (!latestAnalysis) {
    actions.push({
      id: "run-codemap",
      title: "Run CodeMap Lite analysis.",
      detail: "This project is ready for rule-based path analysis.",
      targetId: "codemap",
      priority: 20,
    });
  } else if (latestAnalysis.status === "failed") {
    actions.push({
      id: "retry-codemap",
      title: "Retry CodeMap Lite analysis.",
      detail: "The latest CodeMap Lite attempt did not complete.",
      targetId: "codemap",
      priority: 21,
    });
  }

  if (!project.production_url) {
    actions.push({
      id: "add-production-url",
      title: "Add a production URL.",
      detail: "A production URL gives manual health checks a saved target.",
      targetId: "details",
      priority: 30,
    });
  } else if (!latestHealthCheck) {
    actions.push({
      id: "run-health-check",
      title: "Run a manual health check.",
      detail: "Run a manual health check to add operational evidence.",
      targetId: "health",
      priority: 40,
    });
  } else if (latestHealthCheck.status !== "healthy") {
    actions.push({
      id: "review-health-check",
      title: `Review latest health result: ${healthLabels[latestHealthCheck.status]}.`,
      detail: "The latest manual check needs attention before it becomes strong operational evidence.",
      targetId: "health",
      priority: 41,
    });
  }

  if (!hasReadinessStatus(readiness) || readiness.status === "not_started") {
    actions.push({
      id: "evaluate-readiness",
      title: "Evaluate production readiness.",
      detail: "Readiness is advisory and uses available evidence plus manual review items.",
      targetId: "readiness",
      priority: 50,
    });
  } else {
    const topGaps = Array.isArray(readiness.top_gaps) ? readiness.top_gaps : [];
    topGaps.slice(0, 2).forEach((gap, index) => {
      actions.push({
        id: `readiness-gap-${index}`,
        title: `Review readiness gap: ${gap}`,
        detail: "Use the readiness checklist for evidence and source details.",
        targetId: "readiness",
        priority: 60 + index,
      });
    });
    if (hasUnknownManualReadiness(readiness)) {
      actions.push({
        id: "complete-manual-readiness",
        title: "Complete manual readiness review items.",
        detail: "Manual review items are not inferred automatically.",
        targetId: "readiness",
        priority: 70,
      });
    }
    if (hasUnknownManualReadiness(readiness) && activeArtifactCount > 0) {
      actions.push({
        id: "link-readiness-artifacts",
        title: "Link artifacts to readiness evidence.",
        detail: "Use team-supplied artifacts as supporting references without changing readiness automatically.",
        targetId: "readiness",
        priority: 75,
      });
    }
  }

  if (activeArtifactCount === 0) {
    actions.push({
      id: "add-project-artifact",
      title: "Add a project note or runbook.",
      detail: "Artifacts keep important project knowledge and supporting references visible.",
      targetId: "artifacts",
      priority: 80,
    });
  }

  if (!latestLaunchDecision) {
    actions.push({
      id: "record-launch-decision",
      title: "Record a human launch decision.",
      detail: "Launch Report and Guided Checklist are advisory inputs; the final decision is a human record.",
      targetId: "launch-decision",
      priority: 90,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
