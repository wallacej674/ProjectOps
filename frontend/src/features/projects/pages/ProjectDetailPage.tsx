import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { projectsApi } from "../../../api/projects";
import { AppShell } from "../../../components/layout/AppShell";
import { ErrorState } from "../../../components/ui/ErrorState";
import { SkeletonPanel } from "../../../components/ui/LoadingSkeleton";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate } from "../../../utils/formatDate";
import type { Project } from "../../../types/project";
import type { HealthCheck } from "../../../types/healthCheck";
import type { ProjectReadinessSummary, ReadinessStatus } from "../../../types/readiness";
import type { RepoAnalysis } from "../../../types/repoAnalysis";
import type { RepoIntegration } from "../../../types/repoIntegration";
import { getLatestProjectAnalysis, listProjectAnalyses, runProjectAnalysis } from "../api/projectAnalyses";
import { getLatestProjectHealthCheck, listProjectHealthChecks, runProjectHealthCheck } from "../api/projectHealthChecks";
import { evaluateProjectReadiness, getProjectReadiness, updateProjectReadinessItem } from "../api/projectReadiness";
import { attachProjectRepo, getProjectRepo, removeProjectRepo } from "../api/projectRepo";
import { ArchiveProjectModal } from "../components/ArchiveProjectModal";
import { CodeMapAnalysisCard } from "../components/CodeMapAnalysisCard";
import { HealthMonitoringCard } from "../components/HealthMonitoringCard";
import { ReadinessAssessmentCard } from "../components/ReadinessAssessmentCard";
import { RepositoryConnectionCard } from "../components/RepositoryConnectionCard";
import { RepositoryRemoveModal } from "../components/RepositoryRemoveModal";

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

  useEffect(() => {
    projectsApi
      .get(projectId)
      .then(setProject)
      .catch((e: ApiError) => setError(e.kind === "not-found" ? "This Project was not found." : e.message));
  }, [projectId]);

  useEffect(() => {
    setRepoLoading(true);
    setRepoError("");
    getProjectRepo(projectId)
      .then((nextRepo) => {
        setRepo(nextRepo);
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
        setLatestAnalysis(analysis);
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
        setLatestHealthCheck(healthCheck);
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
        setReadiness(nextReadiness);
        setReadinessError("");
      })
      .catch((e: unknown) => {
        setReadiness(null);
        setReadinessError(readinessErrorMessage(e));
      })
      .finally(() => setReadinessLoading(false));
  }, [projectId]);

  async function runAnalysis() {
    setAnalysisRunning(true);
    setAnalysisError("");
    try {
      const analysis = await runProjectAnalysis(projectId);
      setLatestAnalysis(analysis);
      setAnalysisHistory((currentHistory) => [analysis, ...currentHistory.filter((item) => item.id !== analysis.id)]);
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
    } catch (e) {
      setRepoRemoveError(e instanceof Error ? e.message : "Repository connection could not be removed.");
    } finally {
      setRepoRemovePending(false);
    }
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

  const hasReadinessEvaluation = Boolean(readiness?.status && readiness.status !== "not_started");
  const setup = [
    { label: "Project information", done: true, meta: "Available from Project data." },
    {
      label: "Repository URL",
      done: Boolean(project.repo_url),
      meta: project.repo_url ? "Available from Project data." : "Add repository metadata to this Project.",
    },
    {
      label: "Production URL",
      done: Boolean(project.production_url),
      meta: project.production_url ? "Available from Project data." : "Add a production URL when one exists.",
    },
    {
      label: "Repository analysis",
      done: Boolean(latestAnalysis),
      meta: latestAnalysis ? "Latest CodeMap Lite analysis is available." : "Run CodeMap Lite after attaching a repository.",
    },
    {
      label: "Health checks",
      done: Boolean(latestHealthCheck),
      meta: latestHealthCheck ? "Latest manual health check is available." : "Run a manual check for the production URL.",
    },
    {
      label: "Readiness evaluation",
      done: hasReadinessEvaluation,
      meta: hasReadinessEvaluation ? "Latest advisory readiness result is available." : "Run readiness after evidence exists.",
    },
  ];

  return (
    <AppShell>
      <div className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Project Dashboard</div>
            <h1>{project.name}</h1>
            <p>{project.description || "No description added."}</p>
          </div>
          <div className="top-actions">
            <Link className="button" to={`/app/projects/${project.id}/edit`}>
              Edit Project
            </Link>
            <button className="button danger" type="button" onClick={() => setArchive(true)}>
              Archive Project
            </button>
          </div>
        </div>
        <div className="detail-grid">
          <section className="panel detail-panel">
            <h2>Project information</h2>
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
          <aside className="panel detail-panel">
            <div className="eyebrow">Setup progress</div>
            <h2>Complete project setup to unlock the full command center.</h2>
            <div className="setup">
              {setup.map((item) => (
                <div className={`setup-item ${item.done ? "done" : ""}`} key={item.label}>
                  <span aria-hidden="true">
                    {item.done && (
                      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                        <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <div className="meta">{item.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
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
          <ReadinessAssessmentCard
            readiness={readiness}
            loading={readinessLoading}
            error={readinessError}
            evaluating={readinessEvaluating}
            onEvaluate={runReadinessEvaluation}
            onUpdateManualItem={updateManualReadinessItem}
          />
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
