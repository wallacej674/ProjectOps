import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { Mark } from "../../components/ui/Mark";
import type { HealthCheckStatus } from "../../types/healthCheck";
import type { PublicStatusPage } from "../../types/projectStatusPage";
import { formatDate } from "../../utils/formatDate";
import { getPublicStatusPage } from "./api/publicStatusPage";

const statusLabels: Record<HealthCheckStatus, string> = {
  healthy: "Operational",
  unhealthy: "Unhealthy",
  timeout: "Timing out",
  error: "Errors observed",
};

const statusTone: Record<HealthCheckStatus, "success" | "warning" | "danger"> = {
  healthy: "success",
  unhealthy: "danger",
  timeout: "warning",
  error: "warning",
};

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.kind === "not-found") {
    return "This status page does not exist, or is no longer published.";
  }
  return error instanceof Error ? error.message : "This status page could not load.";
}

export function StatusPage() {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<PublicStatusPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getPublicStatusPage(slug)
      .then((data) => {
        if (!active) return;
        setPage(data);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setPage(null);
        setError(loadErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="content status-page-public">
      <header className="row status-page-header">
        <Link to="/" className="brand" aria-label="ProjectOps home">
          <Mark />
          ProjectOps
        </Link>
      </header>
      {loading ? (
        <p className="meta" aria-live="polite">Loading status...</p>
      ) : error || !page ? (
        <section className="panel empty">
          <h2>Status page unavailable</h2>
          <p>{error || "This status page could not load."}</p>
        </section>
      ) : (
        <section className="panel detail-panel" aria-labelledby="public-status-title">
          <div className="eyebrow">Status</div>
          <h1 id="public-status-title">{page.label}</h1>
          {page.target_url && <p className="meta mono">{page.target_url}</p>}

          {page.active_incident && (
            <div className="status-band tone-warning" role="alert">
              <span className="status-icon" aria-hidden="true">!</span>
              <div>
                <strong className="status-headline">Investigating an active issue</strong>
                <p>
                  First observed {formatDate(page.active_incident.opened_at)}, last observed{" "}
                  {formatDate(page.active_incident.last_observed_at)}.
                </p>
              </div>
            </div>
          )}

          {page.current_status ? (
            <div className={`status-band tone-${statusTone[page.current_status]}`}>
              <span className="status-icon" aria-hidden="true">{page.current_status === "healthy" ? "+" : "!"}</span>
              <div>
                <strong className="status-headline">{statusLabels[page.current_status]}</strong>
                {page.last_checked_at && <p>Last checked {formatDate(page.last_checked_at)}.</p>}
              </div>
            </div>
          ) : (
            <div className="status-band">
              <div>
                <strong className="status-headline">No checks recorded yet</strong>
                <p>This Project has not had a Health Check observation yet.</p>
              </div>
            </div>
          )}

          <h3>Recent observations</h3>
          {page.history.length === 0 ? (
            <p className="meta">No observations recorded yet.</p>
          ) : (
            <ol className="history-list">
              {page.history.map((check, index) => (
                <li key={`${check.checked_at}-${index}`}>
                  <div className="row">
                    <span className={`badge health-status ${check.status}`}>{statusLabels[check.status]}</span>
                    <span className="meta">{formatDate(check.checked_at)}</span>
                  </div>
                  <div className="meta history-meta">
                    <span>{check.http_status_code ? `HTTP ${check.http_status_code}` : "No HTTP status"}</span>
                    <span>{check.response_time_ms !== null ? `${check.response_time_ms} ms` : "No response time"}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <p className="meta status-page-footnote">
            Reflects ProjectOps Health Check observations only; it is not an uptime guarantee. Generated{" "}
            {formatDate(page.generated_at)}.
          </p>
        </section>
      )}
    </div>
  );
}
