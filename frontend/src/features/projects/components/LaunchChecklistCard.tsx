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
          <div className="launch-checklist-summary" aria-label="Launch checklist summary">
            <span>{checklist.summary.done} done</span>
            <span>{checklist.summary.needs_attention} needs attention</span>
            <span>{checklist.summary.todo} todo</span>
            <span>{checklist.summary.total} total</span>
          </div>
          <p className="meta">Generated {formatDate(checklist.generated_at)}</p>
          <ol className="launch-checklist-list">
            {checklist.items.map((item) => (
              <li key={item.key}>
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
