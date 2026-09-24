import { useEffect, useRef, useState } from "react";
import type { ProjectAlertWebhook } from "../../../types/projectAlertWebhook";
import { formatDate } from "../../../utils/formatDate";

export function HealthAlertWebhookCard({
  webhook,
  loading,
  error,
  pending,
  testPending,
  testResult,
  testError,
  onSave,
  onPause,
  onSendTest,
}: {
  webhook: ProjectAlertWebhook | null;
  loading: boolean;
  error: string;
  pending: boolean;
  testPending: boolean;
  testResult: ProjectAlertWebhook | null;
  testError: string;
  onSave: (url: string) => void;
  onPause: () => void;
  onSendTest: () => void;
}) {
  const configureButtonRef = useRef<HTMLButtonElement>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(webhook?.url ?? "");
  }, [webhook?.url]);

  const canSendTest = Boolean(webhook?.enabled && webhook.url) && !testPending;

  return (
    <section className="panel detail-panel" aria-labelledby="alert-webhook-title">
      <div className="eyebrow">Operational Monitoring</div>
      <h2 id="alert-webhook-title">Health Alert Webhook</h2>
      <p>
        Notifies a URL you choose when a Health Alert opens or recovers &mdash; not on acknowledgement or closure.
        Delivery is a single best-effort attempt with no automatic retries or request signing. The payload includes
        a <code>text</code> field, so a Slack incoming webhook URL works directly.
      </p>
      {loading ? (
        <p className="meta" aria-live="polite">Loading alert webhook settings...</p>
      ) : (
        <>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="health-action-header">
            <h3>Delivery</h3>
            <button
              ref={configureButtonRef}
              className="button"
              type="button"
              aria-expanded={configOpen}
              aria-controls="alert-webhook-form"
              disabled={pending}
              onClick={() => setConfigOpen(!configOpen)}
            >
              Configure webhook
            </button>
          </div>
          <p>{webhook?.enabled ? "Alert delivery is enabled." : "Alert delivery is not enabled."}</p>
          {webhook?.last_delivery_attempted_at && (
            <p className="meta">
              Last delivery: {webhook.last_delivery_outcome} ({webhook.last_delivery_transition}) at{" "}
              {formatDate(webhook.last_delivery_attempted_at)}
              {webhook.last_delivery_http_status !== null && ` · HTTP ${webhook.last_delivery_http_status}`}
            </p>
          )}
          {webhook?.last_delivery_outcome === "failed" && webhook.last_delivery_error && (
            <p className="error-text" role="alert">{webhook.last_delivery_error}</p>
          )}
          {configOpen && (
            <div id="alert-webhook-form" className="health-schedule-form">
              <div className="field">
                <label htmlFor="alert-webhook-url">Webhook URL</label>
                <input
                  id="alert-webhook-url"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={url}
                  disabled={pending}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </div>
              <div className="health-action-group">
                <button className="button" type="button" disabled={pending || !url} onClick={() => onSave(url)}>
                  {pending ? "Saving" : webhook?.enabled ? "Save webhook" : "Enable alert delivery"}
                </button>
                {webhook?.enabled && (
                  <button className="button" type="button" disabled={pending} onClick={onPause}>
                    Pause alert delivery
                  </button>
                )}
                <button
                  className="button ghost"
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setUrl(webhook?.url ?? "");
                    setConfigOpen(false);
                    configureButtonRef.current?.focus();
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="health-action-group">
            <button className="button" type="button" disabled={!canSendTest} onClick={onSendTest}>
              {testPending ? "Sending test notification" : "Send test notification"}
            </button>
          </div>
          {testPending && <p className="meta" aria-live="polite">Sending test notification...</p>}
          {testError && <p className="error-text" role="alert">{testError}</p>}
          {testResult && !testError && (
            <p className="meta" role="status">
              Test {testResult.last_delivery_outcome === "delivered" ? "delivered" : "failed"}
              {testResult.last_delivery_http_status !== null && ` · HTTP ${testResult.last_delivery_http_status}`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
