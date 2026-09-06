import { useCallback } from "react";
import { Link } from "react-router-dom";
import { usePolledResource } from "../../hooks/usePolledResource";
import type { ProjectHealthSummary } from "../../types/healthCheck";
import { formatDate } from "../../utils/formatDate";
import { HealthAlertsPanel } from "../projects/components/HealthAlertsPanel";
import { listProjectHealthChecks } from "../projects/api/projectHealthChecks";
import { productionCheck } from "./productionHealth";

export function HealthProjectDetail({ row, onRefresh }: { row: ProjectHealthSummary; onRefresh: () => void }) {
  const load = useCallback(() => listProjectHealthChecks(String(row.project_id)), [row.project_id]);
  const history = usePolledResource(load);
  const check = productionCheck(row);
  const alert = row.monitor?.active_alert;
  const cadence = row.monitor?.cadence_minutes;
  const cadenceLabel = cadence ? ({ 15: "Every 15 minutes", 60: "Every hour", 360: "Every 6 hours", 1440: "Daily" })[cadence] : null;

  return <section className="health-inspector" id="health-project-detail" aria-labelledby="health-selected-title">
    <header className="health-inspector-header">
      <div><p className="health-detail-caption">Project health</p><h2 id="health-selected-title">{row.project_name}</h2><p className="mono health-detail-url">{row.production_url ?? "No production URL configured"}</p></div>
      <Link className="button" to={`/app/projects/${row.project_id}?view=monitoring`}>Manage monitoring</Link>
    </header>
    <div className="health-inspector-signals">
      <div><span>Production target</span><strong>Production target: {check?.status ?? (row.production_url ? "Not checked yet" : "No target")}</strong><p>{check ? formatDate(check.checked_at) : "No matching production check"}</p></div>
      <div><span>Schedule</span><strong>{row.monitor ? row.monitor.enabled ? "Enabled" : "Paused" : "Not configured"}</strong><p>{cadenceLabel ?? "No schedule information"}</p></div>
      <div><span>Last production response</span><strong>{check?.http_status_code ? `HTTP ${check.http_status_code}` : "No HTTP status"}</strong><p>{check?.response_time_ms != null ? `${check.response_time_ms}ms` : "No response time"}</p></div>
    </div>
    {alert && <p className="health-attention">Active alert: scheduled checks are failing{alert.acknowledged_at && " · Acknowledged"}</p>}
    {row.monitor?.next_run_at && row.monitor.enabled && <p className="meta">Next scheduled check: {formatDate(row.monitor.next_run_at)}</p>}
    <section className="health-detail-section" aria-labelledby="health-observation-title">
      <h3 id="health-observation-title">Latest observations</h3>
      <dl className="health-observations">
        <div><dt>Latest scheduled</dt><dd>{row.latest_scheduled_check ? `${row.latest_scheduled_check.status} · ${formatDate(row.latest_scheduled_check.checked_at)}` : "Not checked yet"}</dd></div>
        <div><dt>Latest check</dt><dd>{row.latest_check ? `${row.latest_check.execution_source ?? "manual"} · ${row.latest_check.status} · ${formatDate(row.latest_check.checked_at)}` : "Not checked yet"}</dd></div>
      </dl>
      {row.latest_check && row.latest_check.target_url !== row.production_url && <p className="health-attention">Alternative target: {row.latest_check.target_url}. This result does not establish production health.</p>}
    </section>
    <HealthAlertsPanel projectId={String(row.project_id)} monitor={row.monitor} onRefresh={onRefresh} />
    <section className="health-detail-section" aria-labelledby="health-detail-history-title">
      <div className="health-inspector-header"><h3 id="health-detail-history-title">Check history</h3><button className="button compact" onClick={() => void history.refresh()}>Refresh checks</button></div>
      {history.error && <p role="alert">Check history could not refresh. Displayed data may be stale. {history.error}</p>}
      {!history.data ? <p className="meta">{history.error ? "Check history unavailable." : "Loading checks..."}</p> : !history.data.length ? <p className="meta">No check history yet.</p> : <ol className="health-check-records">{history.data.map(record => <li key={record.id}>
        <details><summary><span className={record.status === "healthy" ? "is-healthy" : ""}>{record.status}</span><span>{record.execution_source ?? "manual"}</span><span>{formatDate(record.checked_at)}</span></summary>
          <div className="health-check-evidence"><p className="mono">{record.target_url}</p><p>{record.http_status_code ? `HTTP ${record.http_status_code}` : "No HTTP status"} · {record.response_time_ms !== null ? `${record.response_time_ms} ms` : "No response time"}</p>{record.error_message && <p>{record.error_message}</p>}{record.response_preview && <pre>{record.response_preview}</pre>}</div>
        </details>
      </li>)}</ol>}
    </section>
  </section>;
}
