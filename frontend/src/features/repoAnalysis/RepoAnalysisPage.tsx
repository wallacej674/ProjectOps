import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import type { ProjectRepoAnalysisOverview } from "../../types/repoAnalysis";
import { formatDate } from "../../utils/formatDate";
import { listCrossProjectRepoAnalysis } from "./api/crossProjectRepoAnalysis";

function statusDotClass(overview: ProjectRepoAnalysisOverview) {
  if (!overview.repo_owner) return "none";
  if (overview.latest_status === "completed") return "healthy";
  if (overview.latest_status === "failed") return "unhealthy";
  return "none";
}

/** Cross-project Repository Analysis: the latest CodeMap Lite result for every Project. */
export function RepoAnalysisPage() {
  const [overviews, setOverviews] = useState<ProjectRepoAnalysisOverview[] | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  useEffect(() => {
    listCrossProjectRepoAnalysis()
      .then(setOverviews)
      .catch((e: ApiError) => setError({ message: e.message, requestId: e.requestId }));
  }, []);

  const total = overviews?.length ?? 0;
  const completed = overviews?.filter((o) => o.latest_status === "completed").length ?? 0;
  const failed = overviews?.filter((o) => o.latest_status === "failed").length ?? 0;
  const notConnected = overviews?.filter((o) => !o.repo_owner).length ?? 0;

  return (
    <AppShell>
      <section className="content" aria-labelledby="repo-analysis-title">
        <div className="page-head">
          <div>
            <div className="eyebrow">Cross-Project Monitoring</div>
            <h1 id="repo-analysis-title">Repository Analysis</h1>
            <p>
              The latest CodeMap Lite result for every Project. Open a Project to connect a repository or run a new
              analysis.
            </p>
          </div>
        </div>

        {error ? (
          <ErrorState title="Repository Analysis could not load." requestId={error.requestId}>
            <p>{error.message}</p>
          </ErrorState>
        ) : overviews === null ? (
          <p className="meta" aria-live="polite">
            Loading repository analysis...
          </p>
        ) : overviews.length === 0 ? (
          <EmptyState title="No projects yet.">
            <p>Create a Project and attach a repository to see its CodeMap analysis here.</p>
          </EmptyState>
        ) : (
          <>
            <div className="stat-strip" aria-label="Repository analysis summary">
              <div className="stat-cell">
                <div className="stat-label">Projects</div>
                <div className="stat-value">{total}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Completed</div>
                <div className="stat-value" style={{ color: "var(--success)" }}>
                  {completed}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Failed</div>
                <div className="stat-value" style={{ color: failed > 0 ? "var(--danger)" : undefined }}>
                  {failed}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Not connected</div>
                <div className="stat-value" style={{ color: "var(--quiet)" }}>
                  {notConnected}
                </div>
              </div>
            </div>

            <ol className="health-row-list" aria-label="Project repository analysis status">
              {overviews.map((overview) => (
                <li className="health-row" key={overview.project_id}>
                  <span className={`status-dot ${statusDotClass(overview)}`} aria-hidden="true" />
                  <div className="health-row-identity">
                    <Link className="health-row-name" to={`/app/projects/${overview.project_id}#codemap`}>
                      {overview.project_name}
                    </Link>
                    <div className="health-row-url mono">
                      {overview.repo_owner ? `${overview.repo_owner}/${overview.repo_name}` : "No repository connected"}
                    </div>
                  </div>
                  <div className="health-row-meta">
                    {overview.latest_status ? (
                      <>
                        <span>{overview.latest_status === "completed" ? "Completed" : "Failed"}</span>
                        {overview.total_files_scanned !== null && <span>{overview.total_files_scanned} files</span>}
                        {overview.analyzed_at && <span className="dim">{formatDate(overview.analyzed_at)}</span>}
                      </>
                    ) : (
                      <span className="dim">{overview.repo_owner ? "Not analyzed yet" : "—"}</span>
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
