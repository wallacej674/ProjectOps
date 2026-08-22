import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { projectsApi } from "../../../api/projects";
import { AppShell } from "../../../components/layout/AppShell";
import { ErrorState } from "../../../components/ui/ErrorState";
import { SkeletonPanel } from "../../../components/ui/LoadingSkeleton";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate } from "../../../utils/formatDate";
import type { Project } from "../../../types/project";
import type { ProjectActivityCategory, ProjectActivityEvent } from "../../../types/projectActivity";
import type { ProjectArtifact, ProjectArtifactCreate, ProjectArtifactUpdate } from "../../../types/projectArtifact";
import type { HealthCheck } from "../../../types/healthCheck";
import type { ProjectLaunchChecklist, ProjectLaunchReport } from "../../../types/launchReport";
import type {
  ProjectReadinessEvidenceCoverage,
  ProjectReadinessSummary,
  ReadinessStatus,
} from "../../../types/readiness";
import type { RepoAnalysis } from "../../../types/repoAnalysis";
import type { RepoIntegration } from "../../../types/repoIntegration";
import { getLatestProjectAnalysis, listProjectAnalyses, runProjectAnalysis } from "../api/projectAnalyses";
import { listProjectActivity } from "../api/projectActivity";
import { listProjectArtifacts } from "../api/projectArtifacts";
import { getLatestProjectHealthCheck, listProjectHealthChecks, runProjectHealthCheck } from "../api/projectHealthChecks";
import { getProjectLaunchChecklist, getProjectLaunchReport } from "../api/projectLaunchReport";
import { evaluateProjectReadiness, getProjectReadiness, updateProjectReadinessItem } from "../api/projectReadiness";
import {
  getReadinessEvidenceCoverage,
  linkReadinessArtifact,
  unlinkReadinessArtifact,
} from "../api/projectReadinessArtifacts";
import { attachProjectRepo, getProjectRepo, removeProjectRepo } from "../api/projectRepo";
import { ArchiveProjectModal } from "../components/ArchiveProjectModal";
import { CodeMapAnalysisCard } from "../components/CodeMapAnalysisCard";
import { HealthMonitoringCard } from "../components/HealthMonitoringCard";
import { LaunchChecklistCard } from "../components/LaunchChecklistCard";
import { LaunchDecisionCard, type LaunchDecisionValue } from "../components/LaunchDecisionCard";
import { LaunchReportCard } from "../components/LaunchReportCard";
import { ProjectArtifactsCard } from "../components/ProjectArtifactsCard";
import { ProjectActivityTimeline } from "../components/ProjectActivityTimeline";
import { ProjectCommandCenterHeader } from "../components/ProjectCommandCenterHeader";
import { ProjectNextActions } from "../components/ProjectNextActions";
import { ProjectSectionNav } from "../components/ProjectSectionNav";
import { ProjectSetupProgress } from "../components/ProjectSetupProgress";
import { ProjectSummaryCards } from "../components/ProjectSummaryCards";
import { ReadinessAssessmentCard } from "../components/ReadinessAssessmentCard";
import { RepositoryConnectionCard } from "../components/RepositoryConnectionCard";
import { RepositoryRemoveModal } from "../components/RepositoryRemoveModal";
import { useProjectArtifacts } from "../hooks/useProjectArtifacts";
import {
  getCodeMapSummary,
  getActivitySummary,
  getArtifactsSummary,
  getHealthSummary,
  getLaunchDecisionSummary,
  getProjectNextActions,
  getProjectSetupSteps,
  getReadinessSummary,
  getRepositorySummary,
} from "../utils/projectCommandCenter";
import {
  getLaunchDecisionHistory,
  launchDecisionLabels,
  launchDecisionTags,
} from "../utils/launchDecisionArtifacts";

/** Single-Project dashboard: identity, metadata, and setup progress. */
function repoErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.kind === "not-found") return "";
  return error instanceof Error ? error.message : "Repository connection could not load.";
}

function analysisErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.kind === "not-found") return "";
  return error instanceof Error ? error.message : "CodeMap Lite analysis could not load.";
}

function healthErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.kind === "not-found") return "";
  return error instanceof Error ? error.message : "Health check could not load.";
}

function runHealthErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.kind === "validation") {
    return "ProjectOps blocked this URL because health checks cannot target local, private, link-local, or otherwise unsafe network addresses.";
  }
  return error instanceof Error ? error.message : "Health check could not run.";
}

function readinessErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.kind === "not-found") return "";
  return error instanceof Error ? error.message : "Readiness assessment could not load.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRepoIntegration(value: unknown): value is RepoIntegration {
  return (
    isRecord(value) &&
    value.provider === "github" &&
    typeof value.repo_owner === "string" &&
    typeof value.repo_name === "string" &&
    typeof value.repo_url === "string"
  );
}

function isRepoAnalysis(value: unknown): value is RepoAnalysis {
  return (
    isRecord(value) &&
    (value.status === "completed" || value.status === "failed") &&
    typeof value.total_files_scanned === "number" &&
    typeof value.created_at === "string"
  );
}

function isHealthCheck(value: unknown): value is HealthCheck {
  return (
    isRecord(value) &&
    (value.status === "healthy" || value.status === "unhealthy" || value.status === "timeout" || value.status === "error") &&
    typeof value.target_url === "string" &&
    typeof value.checked_at === "string" &&
    (typeof value.http_status_code === "number" || value.http_status_code === null) &&
    (typeof value.response_time_ms === "number" || value.response_time_ms === null)
  );
}

function isReadinessSummary(value: unknown): value is ProjectReadinessSummary {
  return (
    isRecord(value) &&
    typeof value.status === "string" &&
    (typeof value.score === "number" || value.score === null) &&
    typeof value.passed === "number" &&
    typeof value.failed === "number" &&
    typeof value.unknown === "number" &&
    typeof value.not_applicable === "number" &&
    typeof value.total_applicable === "number" &&
    Array.isArray(value.top_gaps) &&
    Array.isArray(value.items)
  );
}

function isReadinessEvidenceCoverage(value: unknown): value is ProjectReadinessEvidenceCoverage {
  return (
    isRecord(value) &&
    typeof value.active_artifacts === "number" &&
    typeof value.linked_active_artifacts === "number" &&
    typeof value.unlinked_active_artifacts === "number" &&
    typeof value.readiness_items_with_linked_artifacts === "number" &&
    typeof value.readiness_items_without_linked_artifacts === "number" &&
    typeof value.total_evidence_links === "number" &&
    Array.isArray(value.artifact_usage) &&
    Array.isArray(value.readiness_items)
  );
}

function isProjectActivityEvent(value: unknown): value is ProjectActivityEvent {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.project_id === "number" &&
    typeof value.event_type === "string" &&
    typeof value.event_category === "string" &&
    typeof value.message === "string" &&
    typeof value.created_at === "string"
  );
}

function isProjectArtifact(value: unknown): value is ProjectArtifact {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.project_id === "number" &&
    typeof value.title === "string" &&
    typeof value.artifact_type === "string" &&
    typeof value.source_type === "string" &&
    typeof value.status === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isLaunchReport(value: unknown): value is ProjectLaunchReport {
  return (
    isRecord(value) &&
    (value.decision === "ready" || value.decision === "review" || value.decision === "not_ready") &&
    typeof value.headline === "string" &&
    typeof value.generated_at === "string" &&
    isRecord(value.evidence_summary) &&
    isRecord(value.readiness) &&
    Array.isArray(value.blockers) &&
    Array.isArray(value.recommended_actions)
  );
}

function isLaunchChecklist(value: unknown): value is ProjectLaunchChecklist {
  return (
    isRecord(value) &&
    typeof value.generated_at === "string" &&
    isRecord(value.summary) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        typeof item.key === "string" &&
        typeof item.label === "string" &&
        (item.status === "done" || item.status === "needs_attention" || item.status === "todo") &&
        typeof item.description === "string" &&
        typeof item.action === "string" &&
        typeof item.target === "string",
    )
  );
}

function normalizeCoverageCounts(coverage: ProjectReadinessEvidenceCoverage): ProjectReadinessEvidenceCoverage {
  const activeArtifacts = coverage.artifact_usage.filter((row) => row.artifact.status === "active");
  const linkedActiveArtifacts = activeArtifacts.filter((row) => row.linked_item_count > 0);
  const readinessItemsWithLinks = coverage.readiness_items.filter((row) => row.linked_artifact_count > 0);
  return {
    ...coverage,
    active_artifacts: activeArtifacts.length,
    linked_active_artifacts: linkedActiveArtifacts.length,
    unlinked_active_artifacts: activeArtifacts.length - linkedActiveArtifacts.length,
    readiness_items_with_linked_artifacts: readinessItemsWithLinks.length,
    readiness_items_without_linked_artifacts: coverage.readiness_items.length - readinessItemsWithLinks.length,
    total_evidence_links: coverage.readiness_items.reduce((total, row) => total + row.linked_artifact_count, 0),
  };
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [archive, setArchive] = useState(false);
  const [repo, setRepo] = useState<RepoIntegration | null>(null);
  const [repoLoading, setRepoLoading] = useState(true);
  const [repoError, setRepoError] = useState("");
  const [repoPending, setRepoPending] = useState(false);
  const [repoReplaceMode, setRepoReplaceMode] = useState(false);
  const [repoRemoveOpen, setRepoRemoveOpen] = useState(false);
  const [repoRemovePending, setRepoRemovePending] = useState(false);
  const [repoRemoveError, setRepoRemoveError] = useState("");
  const [latestAnalysis, setLatestAnalysis] = useState<RepoAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<RepoAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [latestHealthCheck, setLatestHealthCheck] = useState<HealthCheck | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [healthRunning, setHealthRunning] = useState(false);
  const [healthHistory, setHealthHistory] = useState<HealthCheck[]>([]);
  const [healthHistoryLoading, setHealthHistoryLoading] = useState(false);
  const [healthHistoryError, setHealthHistoryError] = useState("");
  const [readiness, setReadiness] = useState<ProjectReadinessSummary | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState("");
  const [readinessEvaluating, setReadinessEvaluating] = useState(false);
  const [readinessEvidenceCoverage, setReadinessEvidenceCoverage] = useState<ProjectReadinessEvidenceCoverage | null>(null);
  const [readinessEvidenceLoading, setReadinessEvidenceLoading] = useState(false);
  const [launchReport, setLaunchReport] = useState<ProjectLaunchReport | null>(null);
  const [launchReportLoading, setLaunchReportLoading] = useState(false);
  const [launchReportError, setLaunchReportError] = useState("");
  const [launchChecklist, setLaunchChecklist] = useState<ProjectLaunchChecklist | null>(null);
  const [launchChecklistLoading, setLaunchChecklistLoading] = useState(false);
  const [launchChecklistError, setLaunchChecklistError] = useState("");
  const [latestLaunchDecision, setLatestLaunchDecision] = useState<ProjectArtifact | null>(null);
  const [launchDecisionHistory, setLaunchDecisionHistory] = useState<ProjectArtifact[]>([]);
  const [launchDecisionLoading, setLaunchDecisionLoading] = useState(false);
  const [launchDecisionError, setLaunchDecisionError] = useState("");
  const [activityEvents, setActivityEvents] = useState<ProjectActivityEvent[]>([]);
  const [activitySummaryEvents, setActivitySummaryEvents] = useState<ProjectActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ProjectActivityCategory | "">("");
  const projectArtifacts = useProjectArtifacts(projectId);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError("");
    try {
      const nextEvents = await listProjectActivity(projectId, {
        category: activityCategoryFilter,
      });
      setActivityEvents(Array.isArray(nextEvents) ? nextEvents.filter(isProjectActivityEvent) : []);
    } catch (e) {
      setActivityEvents([]);
      setActivityError(e instanceof Error ? e.message : "Recent activity could not load.");
    } finally {
      setActivityLoading(false);
    }
  }, [activityCategoryFilter, projectId]);

  const loadActivitySummary = useCallback(async () => {
    try {
      const nextEvents = await listProjectActivity(projectId);
      setActivitySummaryEvents(Array.isArray(nextEvents) ? nextEvents.filter(isProjectActivityEvent) : []);
    } catch {
      setActivitySummaryEvents([]);
    }
  }, [projectId]);

  const refreshActivity = useCallback(async () => {
    await Promise.all([loadActivity(), loadActivitySummary()]);
  }, [loadActivity, loadActivitySummary]);

  const loadLaunchReport = useCallback(async () => {
    setLaunchReportLoading(true);
    setLaunchReportError("");
    try {
      const nextReport = await getProjectLaunchReport(projectId);
      setLaunchReport(isLaunchReport(nextReport) ? nextReport : null);
    } catch (e) {
      setLaunchReport(null);
      setLaunchReportError(e instanceof Error ? e.message : "Launch report could not load.");
    } finally {
      setLaunchReportLoading(false);
    }
  }, [projectId]);

  const loadLaunchChecklist = useCallback(async () => {
    setLaunchChecklistLoading(true);
    setLaunchChecklistError("");
    try {
      const nextChecklist = await getProjectLaunchChecklist(projectId);
      setLaunchChecklist(isLaunchChecklist(nextChecklist) ? nextChecklist : null);
    } catch (e) {
      setLaunchChecklist(null);
      setLaunchChecklistError(e instanceof Error ? e.message : "Launch checklist could not load.");
    } finally {
      setLaunchChecklistLoading(false);
    }
  }, [projectId]);

  const refreshLaunchReview = useCallback(async () => {
    await Promise.all([loadLaunchReport(), loadLaunchChecklist()]);
  }, [loadLaunchChecklist, loadLaunchReport]);

  const loadReadinessEvidenceCoverage = useCallback(async () => {
    setReadinessEvidenceLoading(true);
    try {
      const coverage = await getReadinessEvidenceCoverage(projectId);
      setReadinessEvidenceCoverage(isReadinessEvidenceCoverage(coverage) ? coverage : null);
    } catch {
      setReadinessEvidenceCoverage(null);
    } finally {
      setReadinessEvidenceLoading(false);
    }
  }, [projectId]);

  const loadLaunchDecision = useCallback(async () => {
    setLaunchDecisionLoading(true);
    setLaunchDecisionError("");
    try {
      const decisions = await listProjectArtifacts(projectId, {
        artifactType: "decision",
        tags: ["launch-decision"],
      });
      const history = getLaunchDecisionHistory(decisions.filter(isProjectArtifact));
      setLaunchDecisionHistory(history);
      setLatestLaunchDecision(history[0] ?? null);
    } catch (e) {
      setLaunchDecisionHistory([]);
      setLatestLaunchDecision(null);
      setLaunchDecisionError(e instanceof Error ? e.message : "Launch decision could not load.");
    } finally {
      setLaunchDecisionLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    projectsApi
      .get(projectId)
      .then(setProject)
      .catch((e: ApiError) => setError(e.kind === "not-found" ? "This Project was not found." : e.message));
  }, [projectId]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    void loadActivitySummary();
  }, [loadActivitySummary]);

  useEffect(() => {
    void loadReadinessEvidenceCoverage();
  }, [loadReadinessEvidenceCoverage]);

  useEffect(() => {
    setRepoLoading(true);
    setRepoError("");
    getProjectRepo(projectId)
      .then((nextRepo) => {
        setRepo(isRepoIntegration(nextRepo) ? nextRepo : null);
        setRepoError("");
      })
      .catch((e: unknown) => {
        setRepo(null);
        setRepoError(repoErrorMessage(e));
      })
      .finally(() => setRepoLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (repoLoading) return;
    if (!repo) {
      setLatestAnalysis(null);
      setAnalysisHistory([]);
      setAnalysisError("");
      setHistoryError("");
      setAnalysisLoading(false);
      setHistoryLoading(false);
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");
    getLatestProjectAnalysis(projectId)
      .then((analysis) => {
        setLatestAnalysis(isRepoAnalysis(analysis) ? analysis : null);
        setAnalysisError("");
      })
      .catch((e: unknown) => {
        setLatestAnalysis(null);
        setAnalysisError(analysisErrorMessage(e));
      })
      .finally(() => setAnalysisLoading(false));

    setHistoryLoading(true);
    setHistoryError("");
    listProjectAnalyses(projectId)
      .then((analyses) => {
        setAnalysisHistory(analyses);
        setHistoryError("");
      })
      .catch((e: unknown) => {
        setAnalysisHistory([]);
        setHistoryError(e instanceof Error ? e.message : "CodeMap Lite analysis history could not load.");
      })
      .finally(() => setHistoryLoading(false));
  }, [projectId, repo, repoLoading]);

  useEffect(() => {
    if (!project?.production_url) {
      setLatestHealthCheck(null);
      setHealthHistory([]);
      setHealthError("");
      setHealthHistoryError("");
      setHealthLoading(false);
      setHealthHistoryLoading(false);
      return;
    }

    setHealthLoading(true);
    setHealthError("");
    getLatestProjectHealthCheck(projectId)
      .then((healthCheck) => {
        setLatestHealthCheck(isHealthCheck(healthCheck) ? healthCheck : null);
        setHealthError("");
      })
      .catch((e: unknown) => {
        setLatestHealthCheck(null);
        setHealthError(healthErrorMessage(e));
      })
      .finally(() => setHealthLoading(false));

    setHealthHistoryLoading(true);
    setHealthHistoryError("");
    listProjectHealthChecks(projectId)
      .then((healthChecks) => {
        setHealthHistory(healthChecks);
        setHealthHistoryError("");
      })
      .catch((e: unknown) => {
        setHealthHistory([]);
        setHealthHistoryError(e instanceof Error ? e.message : "Health-check history could not load.");
      })
      .finally(() => setHealthHistoryLoading(false));
  }, [project, projectId]);

  useEffect(() => {
    setReadinessLoading(true);
    setReadinessError("");
    getProjectReadiness(projectId)
      .then((nextReadiness) => {
        setReadiness(isReadinessSummary(nextReadiness) ? nextReadiness : null);
        setReadinessError("");
      })
      .catch((e: unknown) => {
        setReadiness(null);
        setReadinessError(readinessErrorMessage(e));
      })
      .finally(() => setReadinessLoading(false));
  }, [projectId]);

  useEffect(() => {
    void refreshLaunchReview();
  }, [refreshLaunchReview]);

  useEffect(() => {
    void loadLaunchDecision();
  }, [loadLaunchDecision]);

  async function runAnalysis() {
    setAnalysisRunning(true);
    setAnalysisError("");
    try {
      const analysis = await runProjectAnalysis(projectId);
      setLatestAnalysis(analysis);
      setAnalysisHistory((currentHistory) => [analysis, ...currentHistory.filter((item) => item.id !== analysis.id)]);
      await Promise.all([refreshActivity(), refreshLaunchReview()]);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "CodeMap Lite analysis could not run.");
    } finally {
      setAnalysisRunning(false);
    }
  }

  async function runHealthCheck(overrideUrl?: string) {
    setHealthRunning(true);
    setHealthError("");
    try {
      const healthCheck = await runProjectHealthCheck(projectId, overrideUrl ? { url: overrideUrl } : undefined);
      setLatestHealthCheck(healthCheck);
      setHealthHistory((currentHistory) => [healthCheck, ...currentHistory.filter((item) => item.id !== healthCheck.id)]);
      await Promise.all([refreshActivity(), refreshLaunchReview()]);
    } catch (e) {
      setHealthError(runHealthErrorMessage(e));
    } finally {
      setHealthRunning(false);
    }
  }

  async function runReadinessEvaluation() {
    setReadinessEvaluating(true);
    setReadinessError("");
    try {
      const nextReadiness = await evaluateProjectReadiness(projectId);
      setReadiness(nextReadiness);
      await Promise.all([loadReadinessEvidenceCoverage(), refreshActivity(), refreshLaunchReview()]);
    } catch (e) {
      setReadinessError(e instanceof Error ? e.message : "Readiness evaluation could not run.");
    } finally {
      setReadinessEvaluating(false);
    }
  }

  async function updateManualReadinessItem(itemKey: string, status: ReadinessStatus, notes: string | null) {
    const updatedItem = await updateProjectReadinessItem(projectId, itemKey, { status, notes });
    setReadiness((currentReadiness) => {
      if (!currentReadiness) return currentReadiness;
      return {
        ...currentReadiness,
        items: currentReadiness.items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
      };
    });
    await Promise.all([refreshActivity(), refreshLaunchReview()]);
  }

  async function linkArtifactEvidence(itemKey: string, artifactId: number) {
    const evidence = await linkReadinessArtifact(projectId, itemKey, artifactId);
    setReadinessEvidenceCoverage((currentCoverage) => {
      if (!currentCoverage) return currentCoverage;
      const readinessItem = readiness?.items.find((item) => item.item.key === itemKey);
      const itemLabel = readinessItem?.item.label ?? itemKey;
      const itemStatus = readinessItem?.status ?? "unknown";
      const nextReadinessItems = currentCoverage.readiness_items.some((row) => row.item_key === itemKey)
        ? currentCoverage.readiness_items.map((row) => {
            if (row.item_key !== itemKey || row.artifacts.some((artifact) => artifact.id === evidence.artifact.id)) {
              return row;
            }
            const artifacts = [...row.artifacts, evidence.artifact];
            return { ...row, linked_artifact_count: artifacts.length, artifacts };
          })
        : [
            ...currentCoverage.readiness_items,
            {
              readiness_item_id: evidence.readiness_item_id,
              item_key: itemKey,
              label: itemLabel,
              status: itemStatus,
              linked_artifact_count: 1,
              artifacts: [evidence.artifact],
            },
          ];
      const nextArtifactUsage = currentCoverage.artifact_usage.some((row) => row.artifact.id === evidence.artifact.id)
        ? currentCoverage.artifact_usage.map((row) => {
            if (row.artifact.id !== evidence.artifact.id || row.readiness_items.some((item) => item.item_key === itemKey)) {
              return row;
            }
            const readinessItems = [
              ...row.readiness_items,
              {
                readiness_item_id: evidence.readiness_item_id,
                item_key: itemKey,
                label: itemLabel,
                status: itemStatus,
              },
            ];
            return { ...row, linked_item_count: readinessItems.length, readiness_items: readinessItems };
          })
        : [
            ...currentCoverage.artifact_usage,
            {
              artifact: evidence.artifact,
              linked_item_count: 1,
              readiness_items: [
                {
                  readiness_item_id: evidence.readiness_item_id,
                  item_key: itemKey,
                  label: itemLabel,
                  status: itemStatus,
                },
              ],
            },
          ];
      return normalizeCoverageCounts({
        ...currentCoverage,
        artifact_usage: nextArtifactUsage,
        readiness_items: nextReadinessItems,
      });
    });
    await Promise.all([refreshActivity(), refreshLaunchReview()]);
  }

  async function unlinkArtifactEvidence(itemKey: string, artifactId: number) {
    await unlinkReadinessArtifact(projectId, itemKey, artifactId);
    setReadinessEvidenceCoverage((currentCoverage) => {
      if (!currentCoverage) return currentCoverage;
      const nextReadinessItems = currentCoverage.readiness_items.map((row) => {
        if (row.item_key !== itemKey) return row;
        const artifacts = row.artifacts.filter((artifact) => artifact.id !== artifactId);
        return { ...row, linked_artifact_count: artifacts.length, artifacts };
      });
      const nextArtifactUsage = currentCoverage.artifact_usage.map((row) => {
        if (row.artifact.id !== artifactId) return row;
        const readinessItems = row.readiness_items.filter((item) => item.item_key !== itemKey);
        return { ...row, linked_item_count: readinessItems.length, readiness_items: readinessItems };
      });
      return normalizeCoverageCounts({
        ...currentCoverage,
        artifact_usage: nextArtifactUsage,
        readiness_items: nextReadinessItems,
      });
    });
    await Promise.all([refreshActivity(), refreshLaunchReview()]);
  }

  async function attachRepo(repoUrl: string) {
    setRepoPending(true);
    setRepoError("");
    try {
      const nextRepo = await attachProjectRepo(projectId, { repo_url: repoUrl });
      setLatestAnalysis(null);
      setAnalysisHistory([]);
      setAnalysisError("");
      setHistoryError("");
      setRepo(nextRepo);
      setRepoReplaceMode(false);
      await Promise.all([refreshActivity(), refreshLaunchReview()]);
    } catch (e) {
      setRepoError(e instanceof Error ? e.message : "Repository could not be attached.");
    } finally {
      setRepoPending(false);
    }
  }

  async function removeRepo() {
    setRepoRemovePending(true);
    setRepoRemoveError("");
    try {
      await removeProjectRepo(projectId);
      setLatestAnalysis(null);
      setAnalysisHistory([]);
      setAnalysisError("");
      setHistoryError("");
      setRepo(null);
      setRepoRemoveOpen(false);
      await Promise.all([refreshActivity(), refreshLaunchReview()]);
    } catch (e) {
      setRepoRemoveError(e instanceof Error ? e.message : "Repository connection could not be removed.");
    } finally {
      setRepoRemovePending(false);
    }
  }

  async function createArtifactAndRefreshActivity(input: ProjectArtifactCreate) {
    await projectArtifacts.createArtifact(input);
    await Promise.all([loadReadinessEvidenceCoverage(), refreshActivity(), refreshLaunchReview()]);
  }

  async function updateArtifactAndRefreshActivity(artifactId: number, input: ProjectArtifactUpdate) {
    await projectArtifacts.updateArtifact(artifactId, input);
    await Promise.all([loadReadinessEvidenceCoverage(), refreshActivity(), refreshLaunchReview()]);
  }

  async function archiveArtifactAndRefreshActivity(artifactId: number) {
    await projectArtifacts.archiveArtifact(artifactId);
    await Promise.all([loadReadinessEvidenceCoverage(), refreshActivity(), refreshLaunchReview()]);
  }

  async function recordLaunchDecision(decision: LaunchDecisionValue, notes: string) {
    const trimmedNotes = notes.trim();
    const summary = trimmedNotes || `Launch decision recorded as ${launchDecisionLabels[decision]}.`;
    await projectArtifacts.createArtifact({
      title: `Launch decision: ${launchDecisionLabels[decision]}`,
      artifact_type: "decision",
      source_type: "manual",
      url: null,
      summary,
      content: `Decision: ${launchDecisionTags[decision]}\n\nNotes:\n${summary}`,
      tags: `launch-decision,go-no-go,${launchDecisionTags[decision]}`,
    });
    await Promise.all([loadLaunchDecision(), loadReadinessEvidenceCoverage(), refreshActivity(), refreshLaunchReview()]);
  }

  if (error)
    return (
      <AppShell>
        <div className="content">
          <ErrorState title="Project unavailable">
            <p>{error}</p>
            <Link className="button" to="/app/projects">
              Back to Projects
            </Link>
          </ErrorState>
        </div>
      </AppShell>
    );
  if (!project)
    return (
      <AppShell>
        <div className="content">
          <SkeletonPanel height={360} />
        </div>
      </AppShell>
    );

  const repositorySummary = getRepositorySummary(repo);
  const codeMapSummary = getCodeMapSummary(repo, latestAnalysis);
  const healthSummary = getHealthSummary(project, latestHealthCheck);
  const readinessSummary = getReadinessSummary(readiness);
  const artifactsSummary = getArtifactsSummary(projectArtifacts.artifacts);
  const activitySummary = getActivitySummary(activitySummaryEvents);
  const launchDecisionSummary = getLaunchDecisionSummary(latestLaunchDecision);
  const commandCenterInput = {
    project,
    repo,
    latestAnalysis,
    latestHealthCheck,
    readiness,
    artifacts: projectArtifacts.artifacts,
    activityEvents: activitySummaryEvents,
    latestLaunchDecision,
  };
  const nextActions = getProjectNextActions(commandCenterInput);
  const setupSteps = getProjectSetupSteps(commandCenterInput);

  return (
    <AppShell>
      <div className="content">
        <section className="command-center" id="overview" aria-label="Project Command Center">
          <ProjectCommandCenterHeader
            project={project}
            repositorySummary={repositorySummary}
            healthSummary={healthSummary}
            primaryAction={nextActions[0]}
            titleId="command-center-title"
            onArchive={() => setArchive(true)}
          />
          <ProjectSummaryCards
            items={[
              { label: "Repository", summary: repositorySummary },
              { label: "CodeMap", summary: codeMapSummary },
              { label: "Health", summary: healthSummary },
              { label: "Readiness", summary: readinessSummary },
              { label: "Launch Decision", summary: launchDecisionSummary },
              { label: "Artifacts", summary: artifactsSummary },
              { label: "Activity", summary: activitySummary },
            ]}
          />
          <div className="command-grid">
            <ProjectNextActions actions={nextActions} />
            <ProjectSetupProgress steps={setupSteps} />
          </div>
        </section>
        <ProjectSectionNav />
        <div className="detail-grid">
          <div id="repository" className="section-anchor">
            <RepositoryConnectionCard
              repo={repo}
              loading={repoLoading}
              error={repoError}
              pending={repoPending}
              replaceMode={repoReplaceMode}
              onStartReplace={() => setRepoReplaceMode(true)}
              onCancelReplace={() => {
                setRepoError("");
                setRepoReplaceMode(false);
              }}
              onRemove={() => {
                setRepoRemoveError("");
                setRepoRemoveOpen(true);
              }}
              onAttach={attachRepo}
            />
          </div>
          <div id="codemap" className="section-anchor">
            <CodeMapAnalysisCard
              repo={repo}
              repoLoading={repoLoading}
              latestAnalysis={latestAnalysis}
              analysisLoading={analysisLoading}
              analysisRunning={analysisRunning}
              analysisError={analysisError}
              analysisHistory={analysisHistory}
              historyLoading={historyLoading}
              historyError={historyError}
              onRunAnalysis={runAnalysis}
            />
          </div>
          <div id="health" className="section-anchor">
            <HealthMonitoringCard
              project={project}
              latestHealthCheck={latestHealthCheck}
              healthLoading={healthLoading}
              healthError={healthError}
              healthHistory={healthHistory}
              historyLoading={healthHistoryLoading}
              historyError={healthHistoryError}
              healthRunning={healthRunning}
              onRunHealthCheck={runHealthCheck}
            />
          </div>
          <div id="readiness" className="section-anchor">
            <ReadinessAssessmentCard
              readiness={readiness}
              loading={readinessLoading}
              error={readinessError}
              evaluating={readinessEvaluating}
              artifacts={projectArtifacts.artifacts}
              evidenceCoverage={readinessEvidenceCoverage}
              evidenceLoading={readinessEvidenceLoading}
              onEvaluate={runReadinessEvaluation}
              onUpdateManualItem={updateManualReadinessItem}
              onLinkArtifactEvidence={linkArtifactEvidence}
              onUnlinkArtifactEvidence={unlinkArtifactEvidence}
            />
          </div>
          <div id="launch-report" className="section-anchor">
            <LaunchReportCard report={launchReport} loading={launchReportLoading} error={launchReportError} />
          </div>
          <LaunchChecklistCard
            checklist={launchChecklist}
            loading={launchChecklistLoading}
            error={launchChecklistError}
          />
          <div id="launch-decision" className="section-anchor">
            <LaunchDecisionCard
              decisionHistory={launchDecisionHistory}
              latestDecision={latestLaunchDecision}
              loading={launchDecisionLoading}
              error={launchDecisionError}
              pending={projectArtifacts.mutationPending}
              onRecord={recordLaunchDecision}
            />
          </div>
          <div id="artifacts" className="section-anchor">
            <ProjectArtifactsCard
              artifacts={projectArtifacts.artifacts}
              loading={projectArtifacts.loading}
              error={projectArtifacts.error}
              includeArchived={projectArtifacts.includeArchived}
              artifactTypeFilter={projectArtifacts.artifactTypeFilter}
              sourceTypeFilter={projectArtifacts.sourceTypeFilter}
              search={projectArtifacts.search}
              selectedTags={projectArtifacts.selectedTags}
              evidenceCoverage={readinessEvidenceCoverage}
              pending={projectArtifacts.mutationPending}
              onIncludeArchivedChange={projectArtifacts.setIncludeArchived}
              onArtifactTypeFilterChange={projectArtifacts.setArtifactTypeFilter}
              onSourceTypeFilterChange={projectArtifacts.setSourceTypeFilter}
              onSearchChange={projectArtifacts.setSearch}
              onToggleTag={projectArtifacts.toggleTagFilter}
              onClearFilters={projectArtifacts.clearFilters}
              onCreate={createArtifactAndRefreshActivity}
              onUpdate={updateArtifactAndRefreshActivity}
              onArchive={archiveArtifactAndRefreshActivity}
            />
          </div>
          <div id="activity" className="section-anchor">
            <ProjectActivityTimeline
              events={activityEvents}
              loading={activityLoading}
              error={activityError}
              categoryFilter={activityCategoryFilter}
              onCategoryFilterChange={setActivityCategoryFilter}
              onClearFilters={() => setActivityCategoryFilter("")}
              onRefresh={() => void refreshActivity()}
            />
          </div>
          <section className="panel detail-panel" id="details" aria-label="Project Details">
            <h2 id="project-details-title">Project information</h2>
            <dl>
              <div className="definition">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={project.status} />
                </dd>
              </div>
              <div className="definition">
                <dt>Repository URL</dt>
                <dd className="mono">{project.repo_url || "Not added"}</dd>
              </div>
              <div className="definition">
                <dt>Production URL</dt>
                <dd className="mono">{project.production_url || "Not added"}</dd>
              </div>
              <div className="definition">
                <dt>Created</dt>
                <dd>{formatDate(project.created_at)}</dd>
              </div>
              <div className="definition">
                <dt>Last updated</dt>
                <dd>{formatDate(project.updated_at)}</dd>
              </div>
              <div className="definition">
                <dt>Project ID</dt>
                <dd className="mono">{project.id}</dd>
              </div>
            </dl>
          </section>
        </div>
        {archive && (
          <ArchiveProjectModal
            project={project}
            onClose={() => setArchive(false)}
            onSuccess={() => navigate("/app/projects")}
          />
        )}
        {repoRemoveOpen && repo && (
          <RepositoryRemoveModal
            repo={repo}
            pending={repoRemovePending}
            error={repoRemoveError}
            onClose={() => setRepoRemoveOpen(false)}
            onConfirm={removeRepo}
          />
        )}
      </div>
    </AppShell>
  );
}
