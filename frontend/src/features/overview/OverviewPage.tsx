import { usePolledResource } from "../../hooks/usePolledResource";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { demoDataApi } from "../../api/demoData";
import { projectsApi } from "../../api/projects";
import { AppShell } from "../../components/layout/AppShell";
import { ErrorState } from "../../components/ui/ErrorState";
import type { Project } from "../../types/project";
import type { ProjectArtifactOverview } from "../../types/projectArtifact";
import type { CrossProjectActivityEvent, ProjectActivityCategory } from "../../types/projectActivity";
import type { ProjectReadinessOverview } from "../../types/readiness";
import type { ProjectRepoAnalysisOverview } from "../../types/repoAnalysis";
import { formatDate } from "../../utils/formatDate";
import { listCrossProjectArtifactsOverview } from "../artifactsOverview/api/crossProjectArtifacts";
import { listCrossProjectHealth } from "../health/api/crossProjectHealth";
import { buildProjectOperationalSnapshots } from "../projects/utils/projectPortfolio";
import { listActivity } from "../projects/api/projectActivity";
import { listCrossProjectReadiness } from "../readiness/api/crossProjectReadiness";
import { listCrossProjectRepoAnalysis } from "../repoAnalysis/api/crossProjectRepoAnalysis";
import { AttentionQueue } from "./components/AttentionQueue";
import { PortfolioStatus } from "./components/PortfolioStatus";
import { RecentProjects } from "./components/RecentProjects";
import { SignalBoard } from "./components/SignalBoard";
import { buildOverviewPortfolio } from "./utils/overviewPortfolio";
import {
  summarizeArtifactsSignal,
  summarizeHealthSignal,
  summarizeReadinessSignal,
  summarizeRepoAnalysisSignal,
} from "./utils/signalBoard";

const categoryOptions: { value: ProjectActivityCategory | ""; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "project", label: "Project" },
  { value: "repository", label: "Repository" },
  { value: "codemap", label: "CodeMap" },
  { value: "health", label: "Health" },
  { value: "readiness", label: "Readiness" },
  { value: "artifact", label: "Artifacts" },
  { value: "evidence", label: "Evidence" },
];

/** Portfolio command center ordered around state, required action, evidence, and history. */
export function OverviewPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const healthResource = usePolledResource(listCrossProjectHealth);
  const healthRows = useMemo(() => healthResource.data ?? [], [healthResource.data]);
  const [readinessRows, setReadinessRows] = useState<ProjectReadinessOverview[]>([]);
  const [repoRows, setRepoRows] = useState<ProjectRepoAnalysisOverview[]>([]);
  const [artifactRows, setArtifactRows] = useState<ProjectArtifactOverview[]>([]);
  const [activityEvents, setActivityEvents] = useState<CrossProjectActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ProjectActivityCategory | "">("");
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [demoStatus, setDemoStatus] = useState<{ enabled: boolean; reason: string | null } | null>(null);
  const [demoStatusError, setDemoStatusError] = useState("");
  const [demoSeedPending, setDemoSeedPending] = useState(false);
  const [demoSeedError, setDemoSeedError] = useState("");

  const loadProjects = useCallback(async () => {
    setError("");
    try {
      setProjects(await projectsApi.list(true));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Projects could not load.");
    }
  }, []);

  const loadSignals = useCallback(async () => {
    const [readiness, repositories, artifacts] = await Promise.allSettled([
      listCrossProjectReadiness(),
      listCrossProjectRepoAnalysis(),
      listCrossProjectArtifactsOverview(),
    ]);
    if (readiness.status === "fulfilled") setReadinessRows(Array.isArray(readiness.value) ? readiness.value : []);
    if (repositories.status === "fulfilled") setRepoRows(Array.isArray(repositories.value) ? repositories.value : []);
    if (artifacts.status === "fulfilled") setArtifactRows(Array.isArray(artifacts.value) ? artifacts.value : []);
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError("");
    try {
      const events = await listActivity({ category: activityCategoryFilter, limit: 25 });
      setActivityEvents(Array.isArray(events) ? events : []);
    } catch (loadError) {
      setActivityEvents([]);
      setActivityError(loadError instanceof Error ? loadError.message : "Recent activity could not load.");
    } finally {
      setActivityLoading(false);
    }
  }, [activityCategoryFilter]);

  useEffect(() => {
    void loadProjects();
    void loadSignals();
  }, [loadProjects, loadSignals]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    if (projects !== null && !activityLoading && lastUpdatedAt === null) setLastUpdatedAt(Date.now());
  }, [activityLoading, lastUpdatedAt, projects]);

  useEffect(() => {
    demoDataApi
      .status()
      .then((status) => {
        if (typeof status.enabled === "boolean") setDemoStatus(status);
      })
      .catch((statusError: Error) => setDemoStatusError(statusError.message));
  }, []);

  const snapshots = useMemo(
    () => buildProjectOperationalSnapshots(projects ?? [], healthRows, readinessRows),
    [projects, healthRows, readinessRows],
  );
  const portfolio = useMemo(
    () =>
      buildOverviewPortfolio(
        projects ?? [],
        snapshots,
        healthRows,
        readinessRows,
        repoRows,
        artifactRows,
        activityEvents,
      ),
    [projects, snapshots, healthRows, readinessRows, repoRows, artifactRows, activityEvents],
  );
  const visibleActivity = activityEvents.slice(0, 8);
  const hasActiveActivityFilters = Boolean(activityCategoryFilter);
  const healthSignal = summarizeHealthSignal(healthRows);
  const readinessSignal = summarizeReadinessSignal(readinessRows);
  const repoAnalysisSignal = summarizeRepoAnalysisSignal(repoRows);
  const artifactsSignal = summarizeArtifactsSignal(artifactRows);

  async function refreshOverview() {
    setOverviewRefreshing(true);
    try {
      await Promise.all([loadProjects(), loadSignals(), loadActivity(), healthResource.refresh()]);
      setLastUpdatedAt(Date.now());
    } finally {
      setOverviewRefreshing(false);
    }
  }

  async function seedDemoWorkspace() {
    setDemoSeedPending(true);
    setDemoSeedError("");
    try {
      const result = await demoDataApi.seed();
      navigate(`/app/projects/${result.project.id}`);
    } catch (seedError) {
      setDemoSeedError(seedError instanceof Error ? seedError.message : "Demo workspace could not be created.");
      await Promise.all([loadProjects(), loadSignals(), loadActivity(), healthResource.refresh()]);
    } finally {
      setDemoSeedPending(false);
    }
  }

  return (
    <AppShell>
      <div className="content overview-page">
        <div className="page-head overview-page-head">
          <div>
            <div className="eyebrow">Portfolio</div>
            <h1>Overview</h1>
            <p>Operational state, evidence, and recent change across every project.</p>
          </div>
          <div className="overview-header-actions">
            <Link to="/app/projects/new" className="button primary compact" aria-label="Create Project">
              <span aria-hidden="true">+</span> Create Project
            </Link>
          </div>
        </div>

        {error ? (
          <ErrorState title="Projects could not load">
            <p>{error}</p>
          </ErrorState>
        ) : (
          <>
            {projects && projects.length > 0 && (
              <>
                <PortfolioStatus
                  model={portfolio}
                  lastUpdatedAt={lastUpdatedAt}
                  refreshing={overviewRefreshing}
                  onRefresh={() => void refreshOverview()}
                />
                <div className="overview-work-grid">
                  {healthResource.error && <p role="alert">Health signals could not refresh. Displayed data may be stale. {healthResource.error}</p>}
            {healthResource.data ? <AttentionQueue items={portfolio.attentionItems} /> : <p>Health attention status unavailable while signals load.</p>}
                  <section
                    className="panel overview-activity-rail"
                    aria-label="Recent Activity Across Projects"
                    aria-busy={activityLoading}
                  >
                    <header className="overview-panel-heading">
                      <div>
                        <div className="eyebrow">History</div>
                        <h2 id="overview-activity-title">Recent activity</h2>
                      </div>
                      <span className="overview-panel-count">{activityEvents.length}</span>
                    </header>
                    <div className="activity-toolbar compact">
                      <label htmlFor="overview-activity-category-filter" className="sr-only">
                        Filter activity by category
                      </label>
                      <select
                        id="overview-activity-category-filter"
                        value={activityCategoryFilter}
                        onChange={(event) => setActivityCategoryFilter(event.target.value as ProjectActivityCategory | "")}
                      >
                        {categoryOptions.map((option) => (
                          <option value={option.value} key={option.value || "all"}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="meta">
                        {activityEvents.length} event{activityEvents.length === 1 ? "" : "s"} shown
                      </span>
                      {hasActiveActivityFilters && (
                        <button
                          className="ghost-action"
                          type="button"
                          aria-label="Clear activity filters"
                          onClick={() => setActivityCategoryFilter("")}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {activityLoading && (
                      <p className="meta" aria-live="polite">
                        Loading recent activity...
                      </p>
                    )}
                    {!activityLoading && activityError && (
                      <p className="error-text" role="alert">
                        {activityError}
                      </p>
                    )}
                    {!activityLoading && !activityError && activityEvents.length === 0 && (
                      <div className="activity-empty">
                        <h3>{hasActiveActivityFilters ? "No activity matches these filters." : "No activity recorded yet."}</h3>
                        <p>
                          {hasActiveActivityFilters
                            ? "Clear the category filter to review all project history."
                            : "Project actions will appear here as evidence changes."}
                        </p>
                      </div>
                    )}
                    {!activityLoading && !activityError && visibleActivity.length > 0 && (
                      <ol className="overview-timeline" aria-label="Recent activity across Projects">
                        {visibleActivity.map((event) => (
                          <li key={event.id}>
                            <span className={`row-dot ${event.event_category}`} aria-hidden="true" />
                            <div>
                              <Link to={`/app/projects/${event.project_id}`} aria-label={`Open ${event.project_name}`}>
                                {event.project_name}
                              </Link>
                              <p>{event.message}</p>
                              <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                    {!activityLoading && activityEvents.length > visibleActivity.length && (
                      <p className="overview-timeline-count">
                        Showing {visibleActivity.length} of {activityEvents.length} events
                      </p>
                    )}
                  </section>
                </div>

                <SignalBoard
                  items={[
                    { label: "Health", to: "/app/health", summary: healthSignal },
                    { label: "Readiness", to: "/app/readiness", summary: readinessSignal },
                    { label: "Repository Analysis", to: "/app/repository-analysis", summary: repoAnalysisSignal },
                    { label: "Artifacts", to: "/app/artifacts", summary: artifactsSignal },
                  ]}
                />
                <RecentProjects rows={portfolio.recentProjects} />
              </>
            )}

            {projects && projects.length === 0 && (
              <section className="panel first-run-panel" aria-labelledby="first-run-title">
                <div>
                  <div className="eyebrow">First run</div>
                  <h2 id="first-run-title">Start with a Project, or load a sample workspace.</h2>
                  <p>
                    ProjectOps becomes useful when a Project has repository context, health evidence, readiness review,
                    artifacts, and activity. Demo data is sample material for local exploration.
                  </p>
                </div>
                <div className="first-run-actions">
                  <Link to="/app/projects/new" className="button primary">
                    Create Project
                  </Link>
                  {demoStatus?.enabled && (
                    <button className="button" type="button" onClick={() => void seedDemoWorkspace()} disabled={demoSeedPending}>
                      {demoSeedPending ? "Loading demo..." : "Load demo workspace"}
                    </button>
                  )}
                  {!demoStatus?.enabled && demoStatus?.reason && <p className="meta">{demoStatus.reason}</p>}
                  {demoStatusError && <p className="meta">Demo data controls could not load: {demoStatusError}</p>}
                  {demoSeedError && (
                    <p className="error-text" role="alert">
                      {demoSeedError}
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
