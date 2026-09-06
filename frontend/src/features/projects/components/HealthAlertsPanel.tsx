import { useCallback, useEffect, useState } from "react";
import type { HealthMonitorSchedule } from "../../../types/healthCheck";
import { usePolledResource } from "../../../hooks/usePolledResource";
import { formatDate } from "../../../utils/formatDate";
import { acknowledgeHealthAlert, getHealthAlert, listHealthAlerts } from "../api/healthAlerts";

const closureLabels: Record<string, string> = {
  target_changed: "Closed: production target changed; recovery unconfirmed",
  target_removed: "Closed: production target removed; recovery unconfirmed",
  project_archived: "Closed: Project archived; recovery unconfirmed",
};

function AlertEvidence({ projectId, alertId }: { projectId: string; alertId: number }) {
  const [offset, setOffset] = useState(0);
  const load = useCallback(() => getHealthAlert(projectId, alertId, offset), [projectId, alertId, offset]);
  const { data, error } = usePolledResource(load);
  return <section aria-label="Supporting scheduled checks">
    {error && <p role="alert">Supporting checks could not refresh. Displayed evidence may be stale. {error}</p>}
    {!data ? <p>Loading supporting checks...</p> : <>
      <p>{data.evidence.total} supporting scheduled checks</p>
      {data.evidence.items.length === 0 ? <p>No supporting checks on this page.</p> : <ol className="history-list">
        {data.evidence.items.map(check => <li key={check.id}>
          <strong>{check.status}</strong> · {formatDate(check.checked_at)} · {check.http_status_code ? `HTTP ${check.http_status_code}` : "No HTTP response"}
          {check.response_time_ms !== null && <span> · {check.response_time_ms} ms</span>}
          {check.error_message && <p>{check.error_message}</p>}
        </li>)}
      </ol>}
      <button className="button compact" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous checks</button>{" "}
      <button className="button compact" disabled={offset + 25 >= data.evidence.total} onClick={() => setOffset(offset + 25)}>Next checks</button>
    </>}
  </section>;
}

export function HealthAlertsPanel({ projectId, monitor, onRefresh }: {
  projectId: string; monitor?: HealthMonitorSchedule | null; onRefresh: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const load = useCallback(() => listHealthAlerts(projectId, offset), [projectId, offset]);
  const { data, error, refresh, setData } = usePolledResource(load);
  useEffect(() => { void refresh(); }, [monitor?.updated_at, refresh]);
  async function acknowledge(id: number) {
    setPending(id); setActionError(""); setMessage("");
    try {
      const updated = await acknowledgeHealthAlert(projectId, id);
      if (data) setData({ ...data, items: data.items.map(item => item.id === id ? updated : item) });
      setMessage("Alert acknowledged. It remains active until recovery is confirmed.");
      onRefresh();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Acknowledgement failed."); }
    finally { setPending(null); }
  }
  return <section className="health-section health-alerts" aria-labelledby={`alerts-title-${projectId}`}>
    <h3 id={`alerts-title-${projectId}`}>Health Alerts</h3>
    <p className="meta">Two failed scheduled checks open an alert. Two healthy scheduled checks confirm recovery. Manual checks do not change alerts.</p>
    {monitor?.freshness === "overdue" && <p role="status">Monitoring overdue. Endpoint health is unconfirmed because scheduled results are late.</p>}
    {monitor?.active_alert && !monitor.enabled && <p role="status">Monitoring paused; recovery unconfirmed.</p>}
    {monitor?.active_alert && monitor.consecutive_healthy === 1 && <p role="status">Recovery pending: 1 of 2 healthy checks.</p>}
    {!monitor?.active_alert && monitor?.consecutive_failures === 1 && <p>1 of 2 failures; no alert yet.</p>}
    {error && <p role="alert">Alerts could not refresh. Displayed data may be stale. {error}</p>}
    {actionError && <p role="alert">{actionError}</p>}
    {message && <p role="status">{message}</p>}
    {!data ? <p>{error ? "Alert status unavailable." : "Loading alerts..."}</p> : <>
      {data.items.length === 0 ? <p>No health alert history yet.</p> : <ol className="history-list">
        {data.items.map(alert => <li key={alert.id}>
          <strong>{alert.status === "active" ? "Scheduled checks are failing" : alert.status === "recovered" ? "Recovered" : closureLabels[alert.closure_reason ?? ""] ?? "Closed"}</strong>
          <p className="mono">{alert.target_url}</p>
          <p>First failure: {formatDate(alert.first_failure_at)} · Latest observation: {formatDate(alert.last_observed_at)} · {alert.failure_count} failed checks</p>
          {alert.recovered_at && <p>Recovery confirmed: {formatDate(alert.recovered_at)}</p>}
          {alert.acknowledged_at ? <p>Acknowledged by account #{alert.acknowledged_by_user_id} · {formatDate(alert.acknowledged_at)}</p> : alert.status === "active" &&
            <button className="button compact" disabled={pending !== null} onClick={() => void acknowledge(alert.id)}>{pending === alert.id ? "Acknowledging..." : "Acknowledge alert"}</button>}
          {" "}<button className="button compact" aria-expanded={selected === alert.id} onClick={() => setSelected(selected === alert.id ? null : alert.id)}>Inspect evidence #{alert.id}</button>
          {selected === alert.id && <AlertEvidence projectId={projectId} alertId={alert.id} />}
        </li>)}
      </ol>}
      <button className="button compact" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous alerts</button>{" "}
      <button className="button compact" disabled={offset + 25 >= data.total} onClick={() => setOffset(offset + 25)}>Next alerts</button>
    </>}
  </section>;
}
