import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import type { ProjectArtifactOverview } from "../../types/projectArtifact";
import { formatDate } from "../../utils/formatDate";
import { listCrossProjectArtifactsOverview } from "./api/crossProjectArtifacts";

/** Cross-project Artifacts: the active artifact count and most recent record for every Project. */
export function ArtifactsOverviewPage() {
  const [overviews, setOverviews] = useState<ProjectArtifactOverview[] | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  useEffect(() => {
    listCrossProjectArtifactsOverview()
      .then(setOverviews)
      .catch((e: ApiError) => setError({ message: e.message, requestId: e.requestId }));
  }, []);

  const total = overviews?.length ?? 0;
  const withArtifacts = overviews?.filter((o) => o.active_artifact_count > 0).length ?? 0;
  const totalArtifacts = overviews?.reduce((sum, o) => sum + o.active_artifact_count, 0) ?? 0;
  const withoutArtifacts = total - withArtifacts;

  return (
    <AppShell>
      <section className="content" aria-labelledby="artifacts-overview-title">
        <div className="page-head">
          <div>
            <div className="eyebrow">Cross-Project Monitoring</div>
            <h1 id="artifacts-overview-title">Artifacts</h1>
            <p>
              Active notes, links, runbooks, and evidence records across every Project. Open a Project to add or
              manage its artifacts.
            </p>
          </div>
        </div>

        {error ? (
          <ErrorState title="Artifacts could not load." requestId={error.requestId}>
            <p>{error.message}</p>
          </ErrorState>
        ) : overviews === null ? (
          <p className="meta" aria-live="polite">
            Loading artifacts...
          </p>
        ) : overviews.length === 0 ? (
          <EmptyState title="No projects yet.">
            <p>Create a Project and add a note, link, or runbook to see it here.</p>
          </EmptyState>
        ) : (
          <>
            <div className="stat-strip" aria-label="Artifacts summary">
              <div className="stat-cell">
                <div className="stat-label">Projects</div>
                <div className="stat-value">{total}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Total artifacts</div>
                <div className="stat-value">{totalArtifacts}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">With artifacts</div>
                <div className="stat-value" style={{ color: "var(--success)" }}>
                  {withArtifacts}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Without artifacts</div>
                <div className="stat-value" style={{ color: "var(--quiet)" }}>
                  {withoutArtifacts}
                </div>
              </div>
            </div>

            <ol className="health-row-list" aria-label="Project artifacts status">
              {overviews.map((overview) => (
                <li className="health-row" key={overview.project_id}>
                  <span className={`status-dot ${overview.active_artifact_count > 0 ? "healthy" : "none"}`} aria-hidden="true" />
                  <div className="health-row-identity">
                    <Link className="health-row-name" to={`/app/projects/${overview.project_id}#artifacts`}>
                      {overview.project_name}
                    </Link>
                    <div className="health-row-url">{overview.most_recent_title ?? "No artifacts yet"}</div>
                  </div>
                  <div className="health-row-meta">
                    <span>{overview.active_artifact_count} active</span>
                    {overview.most_recent_updated_at && (
                      <span className="dim">{formatDate(overview.most_recent_updated_at)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </AppShell>
  );
}
