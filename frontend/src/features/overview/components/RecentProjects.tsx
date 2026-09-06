import { Link } from "react-router-dom";
import { formatDate } from "../../../utils/formatDate";
import type { OverviewProjectRow } from "../utils/overviewPortfolio";

export function RecentProjects({ rows }: { rows: OverviewProjectRow[] }) {
  return (
    <section className="panel recent-projects-panel" aria-label="Recently Active Projects">
      <header className="overview-panel-heading">
        <div>
          <div className="eyebrow">Portfolio</div>
          <h2 id="recent-projects-title">Recent projects</h2>
        </div>
        <Link className="ghost-action" to="/app/projects">
          View all <span aria-hidden="true">→</span>
        </Link>
      </header>
      {rows.length === 0 ? (
        <div className="activity-empty">
          <h3>No active projects.</h3>
          <p>Create a project to begin collecting operational evidence.</p>
        </div>
      ) : (
        <div className="recent-projects-table" role="table" aria-label="Recent Projects">
          <div className="recent-projects-columns" role="row">
            <span role="columnheader">Project</span>
            <span role="columnheader">Environment</span>
            <span role="columnheader">Health</span>
            <span role="columnheader">Readiness</span>
            <span role="columnheader">Latest deployment</span>
          </div>
          {rows.map((row) => {
            const updatedAt = row.latestActivity?.created_at ?? row.project.updated_at;
            return (
              <div className="recent-project-row" role="row" key={row.project.id}>
                <div className="recent-project-name" role="cell">
                  <Link to={`/app/projects/${row.project.id}`} aria-label={`Open ${row.project.name}`}>
                    {row.project.name}
                  </Link>
                  <small>{row.latestActivity?.message ?? `Updated ${formatDate(updatedAt)}`}</small>
                </div>
                <div role="cell">
                  <span className={`badge ${row.project.status}`}>{row.project.status}</span>
                </div>
                <div role="cell" className="recent-project-signal">
                  <span className={`status-dot ${row.snapshot.healthTone}`} aria-hidden="true" />
                  {row.snapshot.healthLabel}
                </div>
                <div role="cell" className="recent-project-signal">
                  <span className={`status-dot ${row.snapshot.readinessTone}`} aria-hidden="true" />
                  {row.snapshot.readinessLabel}
                </div>
                <div role="cell" className="deployment-pending" title="Deployment records are not connected yet">
                  Not tracked yet
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
