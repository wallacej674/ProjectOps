import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import type { HealthCheckStatus, ProjectHealthSummary } from "../../types/healthCheck";
import { formatDate } from "../../utils/formatDate";
import { listCrossProjectHealth } from "./api/crossProjectHealth";

function statusDotClass(summary: ProjectHealthSummary): HealthCheckStatus | "none" {
  if (!summary.production_url || !summary.latest_check) return "none";
  return summary.latest_check.status;
}

/** Cross-project Health Monitoring: the latest manual health check for every Project. */
export function HealthMonitoringPage() {
  const [summaries, setSummaries] = useState<ProjectHealthSummary[] | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  useEffect(() => {
    listCrossProjectHealth()
      .then(setSummaries)
      .catch((e: ApiError) => setError({ message: e.message, requestId: e.requestId }));
  }, []);

  const total = summaries?.length ?? 0;
  const healthy = summaries?.filter((s) => s.latest_check?.status === "healthy").length ?? 0;
  const noTarget = summaries?.filter((s) => !s.production_url).length ?? 0;
  const needsAttention = total - healthy - noTarget;

  return (
    <AppShell>
      <section className="content" aria-labelledby="health-monitoring-title">
        <div className="page-head">
          <div>
            <div className="eyebrow">Cross-Project Monitoring</div>
            <h1 id="health-monitoring-title">Health Monitoring</h1>
            <p>
              The latest manual health check for every Project with a production URL. Open a Project for history and
              to run a new check.
            </p>
          </div>
        </div>

        {error ? (
          <ErrorState title="Health Monitoring could not load." requestId={error.requestId}>
            <p>{error.message}</p>
          </ErrorState>
        ) : summaries === null ? (
          <p className="meta" aria-live="polite">
            Loading health monitoring...
          </p>
        ) : summaries.length === 0 ? (
          <EmptyState title="No projects yet.">
            <p>Create a Project and add a production URL to start monitoring it here.</p>
          </EmptyState>
        ) : (
          <>
            <div className="stat-strip" aria-label="Health monitoring summary">
              <div className="stat-cell">
                <div className="stat-label">Projects</div>
                <div className="stat-value">{total}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Healthy</div>
                <div className="stat-value" style={{ color: "var(--success)" }}>
                  {healthy}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Needs attention</div>
                <div className="stat-value" style={{ color: needsAttention > 0 ? "var(--warning)" : undefined }}>
                  {needsAttention}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">No target</div>
                <div className="stat-value" style={{ color: "var(--quiet)" }}>
                  {noTarget}
                </div>
              </div>
            </div>

            <ol className="health-row-list" aria-label="Project health status">
              {summaries.map((summary) => (
                <li className="health-row" key={summary.project_id}>
                  <span className={`status-dot ${statusDotClass(summary)}`} aria-hidden="true" />
                  <div className="health-row-identity">
                    <Link
                      className="health-row-name"
                      to={`/app/projects/${summary.project_id}#health`}
                      style={!summary.production_url ? { color: "var(--quiet)" } : undefined}
                    >
                      {summary.project_name}
                    </Link>
                    <div className="health-row-url mono" style={!summary.production_url ? { color: "var(--quiet)" } : undefined}>
                      {summary.production_url ?? "No production URL configured"}
                    </div>
                  </div>
                  <div className="health-row-meta">
                    {summary.latest_check ? (
                      <>
                        <span>{summary.latest_check.http_status_code ? `HTTP ${summary.latest_check.http_status_code}` : "No HTTP status"}</span>
                        <span>{summary.latest_check.response_time_ms !== null ? `${summary.latest_check.response_time_ms}ms` : "No response time"}</span>
                        <span className="dim">{formatDate(summary.latest_check.checked_at)}</span>
                      </>
                    ) : (
                      <span className="dim">{summary.production_url ? "Not checked yet" : "—"}</span>
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
