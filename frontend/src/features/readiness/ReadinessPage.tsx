import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import type { ProjectReadinessOverview } from "../../types/readiness";
import { listCrossProjectReadiness } from "./api/crossProjectReadiness";

const statusLabels: Record<string, string> = {
  strong: "Strong",
  in_progress: "In progress",
  needs_work: "Needs work",
  not_started: "Not started",
};

function statusDotClass(overview: ProjectReadinessOverview) {
  if (overview.status === "strong") return "healthy";
  if (overview.status === "in_progress") return "timeout";
  if (overview.status === "needs_work") return "unhealthy";
  return "none";
}

/** Cross-project Readiness: the latest advisory readiness score for every Project. */
export function ReadinessPage() {
  const [overviews, setOverviews] = useState<ProjectReadinessOverview[] | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  useEffect(() => {
    listCrossProjectReadiness()
      .then(setOverviews)
      .catch((e: ApiError) => setError({ message: e.message, requestId: e.requestId }));
  }, []);

  const strong = overviews?.filter((o) => o.status === "strong").length ?? 0;
  const inProgress = overviews?.filter((o) => o.status === "in_progress").length ?? 0;
  const needsWork = overviews?.filter((o) => o.status === "needs_work").length ?? 0;
  const notStarted = overviews?.filter((o) => o.status === "not_started").length ?? 0;

  return (
    <AppShell>
      <section className="content" aria-labelledby="readiness-title">
        <div className="page-head">
          <div>
            <div className="eyebrow">Cross-Project Monitoring</div>
            <h1 id="readiness-title">Readiness</h1>
            <p>
              The latest advisory readiness score for every Project. Open a Project for the full checklist and to
              re-evaluate.
            </p>
          </div>
        </div>

        {error ? (
          <ErrorState title="Readiness could not load." requestId={error.requestId}>
            <p>{error.message}</p>
          </ErrorState>
        ) : overviews === null ? (
          <p className="meta" aria-live="polite">
            Loading readiness...
          </p>
        ) : overviews.length === 0 ? (
          <EmptyState title="No projects yet.">
            <p>Create a Project and run a readiness evaluation to see its advisory score here.</p>
          </EmptyState>
        ) : (
          <>
            <div className="stat-strip" aria-label="Readiness summary">
              <div className="stat-cell">
                <div className="stat-label">Strong</div>
                <div className="stat-value" style={{ color: "var(--success)" }}>
                  {strong}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">In progress</div>
                <div className="stat-value" style={{ color: "var(--warning)" }}>
                  {inProgress}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Needs work</div>
                <div className="stat-value" style={{ color: needsWork > 0 ? "var(--danger)" : undefined }}>
                  {needsWork}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Not started</div>
                <div className="stat-value" style={{ color: "var(--quiet)" }}>
                  {notStarted}
                </div>
              </div>
            </div>

            <ol className="health-row-list" aria-label="Project readiness status">
              {overviews.map((overview) => (
                <li className="health-row" key={overview.project_id}>
                  <span className={`status-dot ${statusDotClass(overview)}`} aria-hidden="true" />
                  <div className="health-row-identity">
                    <Link className="health-row-name" to={`/app/projects/${overview.project_id}#readiness`}>
                      {overview.project_name}
                    </Link>
                    <div className="health-row-url">{statusLabels[overview.status] ?? overview.status}</div>
                  </div>
                  <div className="health-row-meta">
                    <span>{overview.score !== null ? `${overview.score}/100` : "Not evaluated"}</span>
                    {overview.top_gaps[0] && <span className="dim">{overview.top_gaps[0]}</span>}
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
