import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type {
  HealthCheck,
  HealthCheckStatus,
  HealthMonitorCadence,
  HealthMonitorSchedule,
} from "../../../types/healthCheck";
import type { Project } from "../../../types/project";
import { formatDate } from "../../../utils/formatDate";

const statusLabels: Record<HealthCheckStatus, string> = {
  healthy: "Healthy",
  unhealthy: "Unhealthy",
  timeout: "Timeout",
  error: "Error",
};

const statusMeanings: Record<HealthCheckStatus, string> = {
  healthy: "The endpoint responded with a 2xx or 3xx status.",
  unhealthy: "The endpoint responded, but returned a 4xx or 5xx status.",
  timeout: "The endpoint did not respond before the health-check timeout.",
  error: "ProjectOps could not complete the request because of a network or client error.",
};

function HealthCheckStatusBadge({ status }: { status: HealthCheckStatus }) {
  return (
    <span className={`badge health-status ${status}`} aria-label={`Health status: ${statusLabels[status]}`}>
      <span aria-hidden="true">{status === "healthy" ? "+" : "!"}</span>
      {statusLabels[status]}
    </span>
  );
}

function healthTone(status: HealthCheckStatus): "success" | "warning" | "danger" {
  if (status === "healthy") return "success";
  if (status === "unhealthy") return "danger";
  return "warning";
}

const healthTileNote: Record<HealthCheckStatus, string> = {
  healthy: "2xx or 3xx response",
  unhealthy: "4xx or 5xx response",
  timeout: "no response in time",
  error: "network or client error",
};

const healthTileCode: Record<HealthCheckStatus, string> = {
  healthy: "OK",
  unhealthy: "ERR",
  timeout: "TIMEOUT",
  error: "ERR",
};

function HealthCheckResult({ check, projectTargetUrl }: { check: HealthCheck; projectTargetUrl: string }) {
  const showResultTarget = check.target_url !== projectTargetUrl;
  const tone = healthTone(check.status);
  const latencyPct =
    check.response_time_ms !== null ? Math.max(4, Math.min(100, Math.round((check.response_time_ms / 1000) * 100))) : 0;
  const hasLog = Boolean(check.response_preview || check.error_message);

  return (
    <section className="health-section latest-health" aria-labelledby="latest-health-title">
      <div className="row">
        <h3 id="latest-health-title">Latest Health Check</h3>
        <HealthCheckStatusBadge status={check.status} />
      </div>
      <p>{statusMeanings[check.status]}</p>

      <div className="readout">
        <div className="readout-titlebar">
          <span className="readout-dot" aria-hidden="true" />
          <span className="readout-dot" aria-hidden="true" />
          <span className="readout-dot" aria-hidden="true" />
          <span className="readout-title">health &mdash; {showResultTarget ? check.target_url : projectTargetUrl || "target"}</span>
        </div>
        <div className="readout-body">
          <p className="readout-cmd">
            <span className="prompt" aria-hidden="true">
              &gt;
            </span>{" "}
            health check --execution {check.execution_source === "scheduled" ? "scheduled" : "manual"}
          </p>

          <div className="readout-tiles">
            <div className="readout-tile">
              <span className="readout-tile-label">Status</span>
              <span className={`readout-tile-value tone-${tone}`}>{healthTileCode[check.status]}</span>
              <span className="readout-tile-note">{healthTileNote[check.status]}</span>
            </div>
            <div className="readout-tile">
              <span className="readout-tile-label">HTTP</span>
              <span className="readout-tile-value">{check.http_status_code ?? "—"}</span>
            </div>
            <div className="readout-tile">
              <span className="readout-tile-label">Latency</span>
              <span className="readout-tile-value">
                {check.response_time_ms !== null ? (
                  <>
                    {check.response_time_ms}
                    <small>ms</small>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <div className="readout-tile-bar">
                <span className="readout-tile-bar-fill" style={{ width: `${latencyPct}%` }} />
              </div>
            </div>
            <div className="readout-tile">
              <span className="readout-tile-label">Checked</span>
              <span className="readout-tile-value is-text">{formatDate(check.checked_at)}</span>
            </div>
          </div>

          {hasLog && (
            <div className="readout-log">
              {check.response_preview && (
                <>
                  <p className="readout-log-heading" id="health-response-preview-title">
                    <span className="prompt" aria-hidden="true">
                      &rsaquo;
                    </span>{" "}
                    response preview
                  </p>
                  <pre className="readout-pre" aria-labelledby="health-response-preview-title">
                    {check.response_preview}
                  </pre>
                </>
              )}
              {check.error_message && (
                <>
                  <p className="readout-log-heading" id="health-error-message-title">
                    <span className="prompt" aria-hidden="true">
                      &rsaquo;
                    </span>{" "}
                    error
                  </p>
                  <p className="readout-error" role="alert" aria-labelledby="health-error-message-title">
                    {check.error_message}
                  </p>
                </>
              )}
              <span className="readout-cursor" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HealthCheckHistoryList({
  history,
  loading,
  error,
}: {
  history: HealthCheck[];
  loading: boolean;
  error: string;
}) {
  return (
    <section className="health-section" aria-labelledby="health-history-title">
      <h3 id="health-history-title">Health Check History</h3>
      {loading ? (
        <p className="meta" aria-live="polite">Loading health-check history...</p>
      ) : error ? (
        <p className="error-text" role="alert">{error}</p>
      ) : history.length === 0 ? (
        <p className="meta">No health-check history yet.</p>
      ) : (
        <ol className="history-list">
          {history.slice(0, 6).map((check, index) => (
            <li key={check.id}>
              <div className="row">
                <strong>{check.status}</strong>
                {index === 0 && <span className="badge healthy">Latest attempt</span>}
              </div>
              <p className="meta">{check.execution_source === "scheduled" ? "Scheduled check" : "Manual check"}</p>
              <p className="mono">{check.target_url}</p>
              <div className="meta history-meta">
                <span>{check.http_status_code ? `HTTP ${check.http_status_code}` : "No HTTP status"}</span>
                <span>{check.response_time_ms !== null ? `${check.response_time_ms} ms` : "No response time"}</span>
                <span>{formatDate(check.checked_at)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function HealthMonitoringCard({
  project,
  latestHealthCheck,
  healthLoading,
  healthError,
  healthHistory,
  historyLoading,
  historyError,
  healthRunning,
  monitor,
  monitorLoading,
  monitorError,
  monitorPending,
  onRunHealthCheck,
  onUpdateMonitor,
  onPauseMonitor,
}: {
  project: Project;
  latestHealthCheck: HealthCheck | null;
  healthLoading: boolean;
  healthError: string;
  healthHistory: HealthCheck[];
  historyLoading: boolean;
  historyError: string;
  healthRunning: boolean;
  monitor: HealthMonitorSchedule | null;
  monitorLoading: boolean;
  monitorError: string;
  monitorPending: boolean;
  onRunHealthCheck: (overrideUrl?: string) => void;
  onUpdateMonitor: (cadence: HealthMonitorCadence) => void;
  onPauseMonitor: () => void;
}) {
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const wasRunningRef = useRef(false);
  const [useOverrideUrl, setUseOverrideUrl] = useState(false);
  const [overrideUrl, setOverrideUrl] = useState("");
  const [cadence, setCadence] = useState<HealthMonitorCadence>(60);
  const productionUrl = project.production_url;
  const hasProductionUrl = Boolean(productionUrl);
  const runLabel = healthRunning ? "Running Health Check" : latestHealthCheck ? "Run Again" : "Run Health Check";

  useEffect(() => {
    if (wasRunningRef.current && !healthRunning) {
      runButtonRef.current?.focus();
    }
    wasRunningRef.current = healthRunning;
  }, [healthRunning]);

  useEffect(() => {
    if (monitor) setCadence(monitor.cadence_minutes);
  }, [monitor]);

  return (
    <section className="panel detail-panel health-panel" aria-labelledby="health-monitoring-title">
      <div className="eyebrow">Operational Monitoring</div>
      <h2 id="health-monitoring-title">Health Monitoring</h2>
      <p className="health-intro">
        Manual checks are run only when you start them. You can also enable a recurring check against the saved
        production URL. Results are operational signals, not an uptime guarantee, and ProjectOps does not create
        alerts yet.
      </p>
      {!hasProductionUrl ? (
        <div className="health-empty">
          <h3>Add a production URL before running a health check.</h3>
          <p>
            ProjectOps cannot check a service without a target URL. This does not mean the project is unhealthy; it
            means no health-check target exists yet.
          </p>
          <Link className="link" to={`/app/projects/${project.id}/edit`}>
            Edit Project
          </Link>
          <button className="button" type="button" disabled>
            Run Health Check
          </button>
        </div>
      ) : (
        <div className="health-ready">
          <dl>
            <div className="definition">
              <dt>Target production URL</dt>
              <dd className="mono">{productionUrl}</dd>
            </div>
          </dl>
          <section className="health-section" aria-labelledby="scheduled-monitoring-title">
            <h3 id="scheduled-monitoring-title">Scheduled monitoring</h3>
            {monitorLoading ? (
              <p className="meta" aria-live="polite">Loading scheduled monitoring...</p>
            ) : (
              <>
                <p>{monitor?.enabled ? "Scheduled monitoring is enabled." : "Scheduled monitoring is paused."}</p>
                {monitor?.enabled && monitor.next_run_at && <p className="meta">Next check: {formatDate(monitor.next_run_at)}</p>}
                {monitor?.last_completed_at && (
                  <p className="meta">
                    Last scheduled result: {monitor.last_outcome || "unknown"} at {formatDate(monitor.last_completed_at)}
                  </p>
                )}
                {monitorError && <p className="error-text" role="alert">{monitorError}</p>}
                <div className="field">
                  <label htmlFor="health-monitor-cadence">Monitoring frequency</label>
                  <select
                    id="health-monitor-cadence"
                    value={cadence}
                    disabled={monitorPending}
                    onChange={(event) => setCadence(Number(event.target.value) as HealthMonitorCadence)}
                  >
                    <option value={15}>Every 15 minutes</option>
                    <option value={60}>Every hour</option>
                    <option value={360}>Every 6 hours</option>
                    <option value={1440}>Daily</option>
                  </select>
                </div>
                <div className="row">
                  <button
                    className="button"
                    type="button"
                    disabled={monitorPending}
                    onClick={() => onUpdateMonitor(cadence)}
                  >
                    {monitorPending ? "Saving schedule" : monitor?.enabled ? "Update schedule" : "Enable scheduled monitoring"}
                  </button>
                  {monitor?.enabled && (
                    <button className="button" type="button" disabled={monitorPending} onClick={onPauseMonitor}>
                      Pause scheduled monitoring
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
          {healthRunning && (
            <p className="meta" aria-live="polite">
              Manual health check is running...
            </p>
          )}
          {healthLoading ? (
            <p className="meta" aria-live="polite">Loading latest health check...</p>
          ) : healthError ? (
            <p className="error-text" role="alert">{healthError}</p>
          ) : latestHealthCheck ? (
            <HealthCheckResult check={latestHealthCheck} projectTargetUrl={productionUrl || ""} />
          ) : (
            <>
              <h3>No health check has been run yet.</h3>
              <p>Run a manual health check to see whether this endpoint responds.</p>
              <div className="readout is-idle" aria-hidden="true">
                <div className="readout-titlebar">
                  <span className="readout-dot" />
                  <span className="readout-dot" />
                  <span className="readout-dot" />
                  <span className="readout-title">health &mdash; {productionUrl}</span>
                </div>
                <div className="readout-body">
                  <p className="readout-cmd">
                    <span className="prompt">$</span> awaiting first check <span className="readout-cursor" />
                  </p>
                </div>
              </div>
            </>
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={useOverrideUrl}
              onChange={(event) => setUseOverrideUrl(event.target.checked)}
            />
            Check a different URL this time
          </label>
          {useOverrideUrl && (
            <div className="field">
              <label htmlFor="health-override-url">One-time health-check URL</label>
              <input
                id="health-override-url"
                type="url"
                aria-describedby="health-override-url-hint"
                value={overrideUrl}
                onChange={(event) => setOverrideUrl(event.target.value)}
              />
              <div className="hint" id="health-override-url-hint">
                This does not update the Project production URL. Edit the Project to change the saved target.
              </div>
            </div>
          )}
          <button
            ref={runButtonRef}
            className="button primary"
            type="button"
            disabled={healthRunning}
            onClick={() => onRunHealthCheck(useOverrideUrl ? overrideUrl : undefined)}
          >
            {runLabel}
          </button>
          <HealthCheckHistoryList history={healthHistory} loading={historyLoading} error={historyError} />
        </div>
      )}
    </section>
  );
}
