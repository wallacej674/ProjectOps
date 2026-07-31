import { formatDate } from "../../../utils/formatDate";
import type { ProjectActivityCategory, ProjectActivityEvent } from "../../../types/projectActivity";

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

function relatedResourceLabel(event: ProjectActivityEvent) {
  if (!event.related_resource_type || event.related_resource_id === null) return null;
  return `${event.related_resource_type} #${event.related_resource_id}`;
}

function metadataEntries(event: ProjectActivityEvent) {
  if (!event.metadata) return [];
  return Object.entries(event.metadata)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value) && value !== "")
    .slice(0, 4);
}

export function ProjectActivityTimeline({
  events,
  loading,
  error,
  categoryFilter,
  onCategoryFilterChange,
  onClearFilters,
  onRefresh,
}: {
  events: ProjectActivityEvent[];
  loading: boolean;
  error: string;
  categoryFilter: ProjectActivityCategory | "";
  onCategoryFilterChange: (category: ProjectActivityCategory | "") => void;
  onClearFilters: () => void;
  onRefresh?: () => void;
}) {
  const hasActiveFilters = Boolean(categoryFilter);
  const resultLabel = `${events.length} event${events.length === 1 ? "" : "s"} shown`;

  return (
    <section className="panel detail-panel activity-panel" aria-labelledby="activity-title">
      <div className="row activity-heading">
        <div>
          <h2 id="activity-title">Recent Activity</h2>
          <p className="activity-intro">
            Project-scoped history for repository changes, checks, readiness work, artifacts, and evidence links.
          </p>
        </div>
        {onRefresh && (
          <button className="button" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh activity"}
          </button>
        )}
      </div>

      <div className="activity-controls">
        <div className="field">
          <label htmlFor="activity-category-filter">Filter activity by category</label>
          <select
            id="activity-category-filter"
            value={categoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value as ProjectActivityCategory | "")}
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
            {resultLabel}
          </p>
          {hasActiveFilters && <span className="badge">Filters active</span>}
          {hasActiveFilters && (
            <button className="button" type="button" onClick={onClearFilters}>
              Clear activity filters
            </button>
          )}
        </div>
      </div>

      {loading && (
        <p className="meta" aria-live="polite">
          Loading recent activity...
        </p>
      )}
      {!loading && error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && events.length === 0 && !hasActiveFilters && (
        <div className="activity-empty">
          <h3>No activity recorded yet.</h3>
          <p>ProjectOps will record activity as you connect repositories, run checks, evaluate readiness, and manage artifacts.</p>
        </div>
      )}
      {!loading && !error && events.length === 0 && hasActiveFilters && (
        <div className="activity-empty">
          <h3>No activity matches these filters.</h3>
          <p>Clear filters or choose another category to review this Project's activity history.</p>
        </div>
      )}
      {!loading && !error && events.length > 0 && (
        <ol className="activity-timeline" aria-label="Recent activity events">
          {events.map((event) => {
            const resourceLabel = relatedResourceLabel(event);
            const details = metadataEntries(event);
            return (
              <li className={`activity-event ${event.event_category}`} key={event.id}>
                <div className="activity-marker" aria-hidden="true" />
                <div className="activity-event-body">
                  <div className="activity-event-head">
                    <span className={`badge ${event.event_category}`}>{categoryLabels[event.event_category]}</span>
                    <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                  </div>
                  <p>{event.message}</p>
                  {(resourceLabel || details.length > 0) && (
                    <div className="summary-meta activity-meta">
                      {resourceLabel && <span>{resourceLabel}</span>}
                      {details.map(([key, value]) => (
                        <span key={key}>
                          {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
