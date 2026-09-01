import { formatDate } from "../../../utils/formatDate";
import type { LaunchChecklistStatus, ProjectLaunchChecklist } from "../../../types/launchReport";

const statusLabels: Record<LaunchChecklistStatus, string> = {
  done: "Done",
  needs_attention: "Needs attention",
  todo: "Todo",
};

const statusTone: Record<LaunchChecklistStatus, string> = {
  done: "success",
  needs_attention: "warning",
  todo: "neutral",
};

export function LaunchChecklistCard({
  checklist,
  loading,
  error,
}: {
  checklist: ProjectLaunchChecklist | null;
  loading: boolean;
  error: string;
}) {
  return (
    <section className="panel detail-panel launch-checklist-panel" aria-labelledby="launch-checklist-title">
      <div className="eyebrow">Operator Checklist</div>
      <div className="row launch-report-heading">
        <div>
          <h2 id="launch-checklist-title">Guided Launch Checklist</h2>
          <p className="launch-report-intro">
            A concrete checklist for turning the launch snapshot into operator action.
          </p>
        </div>
      </div>
      {loading ? (
        <p className="meta" aria-live="polite">
          Loading launch checklist...
        </p>
      ) : error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : checklist ? (
        <div className="launch-checklist-body">
          <div className="stat-strip" aria-label="Launch checklist summary">
            <div className="stat-cell">
              <div className="stat-label">Done</div>
              <div className="stat-value" style={{ color: "var(--success)" }}>
                {checklist.summary.done}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Needs attention</div>
              <div className="stat-value" style={{ color: "var(--warning)" }}>
                {checklist.summary.needs_attention}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Todo</div>
              <div className="stat-value">{checklist.summary.todo}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Total</div>
              <div className="stat-value">{checklist.summary.total}</div>
            </div>
          </div>
          <p className="meta">Generated {formatDate(checklist.generated_at)}</p>
          <ol className="launch-checklist-list">
            {checklist.items.map((item) => (
              <li key={item.key}>
                <span
                  className={`checkbox ${item.status === "done" ? "on" : item.status === "needs_attention" ? "warn" : "off"}`}
                  aria-hidden="true"
                >
                  {item.status === "done" && (
                    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                  )}
                  {item.status === "needs_attention" && "!"}
                </span>
                <div>
                  <div className="row launch-checklist-row">
                    <strong>{item.label}</strong>
                    <span className={`badge ${statusTone[item.status]}`}>{statusLabels[item.status]}</span>
                  </div>
                  <p>{item.description}</p>
                </div>
                <a className="link" href={item.target}>
                  {item.action}
                </a>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="meta">No launch checklist is available yet.</p>
      )}
    </section>
  );
}
