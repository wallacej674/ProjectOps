import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { demoDataApi } from "../../api/demoData";
import { projectsApi } from "../../api/projects";
import { AppShell } from "../../components/layout/AppShell";
import { ErrorState } from "../../components/ui/ErrorState";
import { formatDate } from "../../utils/formatDate";
import type { Project } from "../../types/project";
import type { CrossProjectActivityEvent, ProjectActivityCategory } from "../../types/projectActivity";
import { listActivity } from "../projects/api/projectActivity";

/** Engineering overview: high-level Project metrics and a future-state preview. */
const categoryLabels: Record<ProjectActivityCategory, string> = {
  project: "Project",
  repository: "Repository",
  codemap: "CodeMap",
  health: "Health",
  readiness: "Readiness",
  artifact: "Artifact",
  evidence: "Evidence",
};

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

function recentlyActiveProjects(events: CrossProjectActivityEvent[]) {
  const byProject = new Map<number, CrossProjectActivityEvent>();
  events.forEach((event) => {
    if (!byProject.has(event.project_id)) byProject.set(event.project_id, event);
  });
  return Array.from(byProject.values());
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [demoStatus, setDemoStatus] = useState<{ enabled: boolean; reason: string | null } | null>(null);
  const [demoStatusError, setDemoStatusError] = useState("");
  const [demoSeedPending, setDemoSeedPending] = useState(false);
  const [demoSeedError, setDemoSeedError] = useState("");
  const [activityEvents, setActivityEvents] = useState<CrossProjectActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ProjectActivityCategory | "">("");

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError("");
    try {
      const events = await listActivity({
        category: activityCategoryFilter,
        limit: 25,
      });
      setActivityEvents(Array.isArray(events) ? events : []);
    } catch (e) {
      setActivityEvents([]);
      setActivityError(e instanceof Error ? e.message : "Recent activity could not load.");
    } finally {
      setActivityLoading(false);
    }
  }, [activityCategoryFilter]);

  const loadProjects = useCallback(() => {
    setError("");
    projectsApi
      .list(true)
      .then(setProjects)
      .catch((e: ApiError) => setError(e.message));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    demoDataApi
      .status()
      .then((status) => {
        if (typeof status.enabled === "boolean") {
          setDemoStatus(status);
        }
      })
      .catch((e: Error) => setDemoStatusError(e.message));
  }, []);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  async function seedDemoWorkspace() {
    setDemoSeedPending(true);
    setDemoSeedError("");
    try {
      const result = await demoDataApi.seed();
      navigate(`/app/projects/${result.project.id}`);
    } catch (e) {
      setDemoSeedError(e instanceof Error ? e.message : "Demo workspace could not be created.");
      loadProjects();
      await loadActivity();
    } finally {
      setDemoSeedPending(false);
    }
  }

  const recentProjects = recentlyActiveProjects(activityEvents);
  const hasActiveActivityFilters = Boolean(activityCategoryFilter);
  const activeProjects = projects?.filter((project) => project.status !== "archived") ?? [];
  const needsSetupCount = activeProjects.filter((project) => !project.repo_url || !project.production_url).length;

  return (
    <AppShell>
      <div className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Overview</div>
            <h1>Understand what needs attention across every project.</h1>
            <p>Start with project context, then add the evidence needed for production decisions.</p>
          </div>
          <Link to="/app/projects/new" className="button primary">
            + Create Project
          </Link>
        </div>
        {error ? (
          <ErrorState title="Projects could not load">
            <p>{error}</p>
          </ErrorState>
        ) : (
          <>
            {projects && (
              <section className="overview-metrics" aria-label="Project overview metrics">
                <div className="metric">
                  <span>Active projects</span>
                  <strong>{activeProjects.length}</strong>
                </div>
                <div className="metric">
                  <span>Recently active Projects</span>
                  <strong>{recentProjects.length}</strong>
                </div>
                <div className="metric">
                  <span>Recent activity events</span>
                  <strong>{activityEvents.length}</strong>
                </div>
                <div className="metric">
                  <span>Needs setup</span>
                  <strong>{needsSetupCount}</strong>
                </div>
              </section>
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
            <div className="overview-activity-grid">
              <section className="panel detail-panel activity-panel" aria-labelledby="overview-activity-title">
                <div className="row activity-heading">
                  <div>
                    <h2 id="overview-activity-title">
                      <span className="section-dot activity" aria-hidden="true" />
                      Recent Activity Across Projects
                    </h2>
                    <p className="activity-intro">
                      Activity updates when ProjectOps actions are recorded. This is product history, not realtime
                      notifications.
                    </p>
                  </div>
                  <button className="button" type="button" onClick={() => void loadActivity()} disabled={activityLoading}>
                    {activityLoading ? "Refreshing..." : "Refresh activity"}
                  </button>
                </div>
                <div className="activity-controls">
                  <div className="field">
                    <label htmlFor="overview-activity-category-filter">Filter activity by category</label>
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
                  </div>
                  <div className="activity-filter-status">
                    <p className="meta" aria-live="polite">
                      {activityEvents.length} event{activityEvents.length === 1 ? "" : "s"} shown
                    </p>
                    {hasActiveActivityFilters && <span className="badge">Filters active</span>}
                    {hasActiveActivityFilters && (
                      <button className="button" type="button" onClick={() => setActivityCategoryFilter("")}>
                        Clear activity filters
                      </button>
                    )}
                  </div>
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
                {!activityLoading && !activityError && activityEvents.length === 0 && !hasActiveActivityFilters && (
                  <div className="activity-empty">
                    <h3>No activity recorded yet.</h3>
                    <p>ProjectOps will record activity as Projects are created, checked, evaluated, and updated.</p>
                  </div>
                )}
                {!activityLoading && !activityError && activityEvents.length === 0 && hasActiveActivityFilters && (
                  <div className="activity-empty">
                    <h3>No activity matches these filters.</h3>
                    <p>Clear filters or choose another category to review activity across Projects.</p>
                  </div>
                )}
                {!activityLoading && !activityError && activityEvents.length > 0 && (
                  <ol className="activity-timeline overview-activity-list" aria-label="Recent activity across Projects">
                    {activityEvents.map((event) => (
                      <li className={`activity-event ${event.event_category}`} key={event.id}>
                        <div className="activity-marker" aria-hidden="true" />
                        <div className="activity-event-body">
                          <div className="activity-event-head">
                            <span className={`badge ${event.event_category}`}>{categoryLabels[event.event_category]}</span>
                            <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                          </div>
                          <p>{event.message}</p>
                          <div className="summary-meta activity-meta">
                            <span>{event.project_name}</span>
                            <span>{event.project_status}</span>
                          </div>
                          <Link className="link overview-activity-link" to={`/app/projects/${event.project_id}`} aria-label={`Open ${event.project_name}`}>
                            Open Project
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section className="panel detail-panel recently-active-panel" aria-labelledby="recently-active-projects-title">
                <h2 id="recently-active-projects-title">
                  <span className="section-dot projects" aria-hidden="true" />
                  Recently Active Projects
                </h2>
                <p className="activity-intro">
                  Projects represented in the latest activity window. Counts are recent indicators, not unread state.
                </p>
                {!activityLoading && !activityError && recentProjects.length === 0 && (
                  <div className="activity-empty">
                    <h3>No recently active Projects.</h3>
                    <p>Activity appears here after ProjectOps records product actions.</p>
                  </div>
                )}
                {!activityLoading && !activityError && recentProjects.length > 0 && (
                  <ol className="recently-active-list" aria-label="Recently active Projects">
                    {recentProjects.map((event) => (
                      <li key={event.project_id}>
                        <div>
                          <strong>{event.project_name}</strong>
                          <p>{event.message}</p>
                          <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                        </div>
                        <Link className="link" to={`/app/projects/${event.project_id}`} aria-label={`Open ${event.project_name}`}>
                          Open
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
