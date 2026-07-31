import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
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
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
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

  useEffect(() => {
    projectsApi
      .list(true)
      .then(setProjects)
      .catch((e: ApiError) => setError(e.message));
  }, []);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const active = projects?.filter((p) => p.status !== "archived") ?? [];
  const setup = active.filter((p) => !p.repo_url || !p.production_url);
  const recentProjects = recentlyActiveProjects(activityEvents);
  const hasActiveActivityFilters = Boolean(activityCategoryFilter);
  const metrics: [string, string | number, string][] = [
    ["Active projects", active.length, "Projects not archived"],
    ["Projects with recent activity", recentProjects.length, "Projects represented in the current activity window"],
    ["Recent activity events", activityEvents.length, "Refresh-based product history"],
    ["Need setup", setup.length, "Missing a repository or production URL"],
  ];

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
            <section className="metrics">
              {metrics.map(([label, value, text]) => (
                <article className="panel metric" key={label}>
                  <div className="eyebrow">{label}</div>
                  <div className="value">{projects ? value : ""}</div>
                  <p>{text}</p>
                </article>
              ))}
            </section>
            <div className="overview-activity-grid">
              <section className="panel detail-panel activity-panel" aria-labelledby="overview-activity-title">
                <div className="row activity-heading">
                  <div>
                    <h2 id="overview-activity-title">Recent Activity Across Projects</h2>
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
                <h2 id="recently-active-projects-title">Recently Active Projects</h2>
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
