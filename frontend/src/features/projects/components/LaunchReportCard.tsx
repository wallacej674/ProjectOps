import { formatDate } from "../../../utils/formatDate";
import type { ProjectLaunchReport, LaunchDecision } from "../../../types/launchReport";

const decisionLabels: Record<LaunchDecision, string> = {
  ready: "Ready",
  review: "Review",
  not_ready: "Not ready",
};

const decisionTone: Record<LaunchDecision, string> = {
  ready: "success",
  review: "warning",
  not_ready: "danger",
};

const evidenceLabels: Record<keyof ProjectLaunchReport["evidence_summary"], string> = {
  repository_connected: "Repository connected",
  codemap_completed: "CodeMap completed",
  health_check_healthy: "Health check healthy",
  production_url_configured: "Production URL configured",
  active_artifacts: "Active artifacts",
  linked_active_artifacts: "Linked active artifacts",
  unlinked_active_artifacts: "Unlinked active artifacts",
  readiness_items_with_linked_artifacts: "Readiness items with supporting artifacts",
  readiness_items_without_linked_artifacts: "Readiness items without supporting artifacts",
  total_evidence_links: "Evidence links",
  activity_events: "Activity events",
};

function actionTarget(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes("repository")) return "#repository";
  if (lower.includes("codemap")) return "#codemap";
  if (lower.includes("health") || lower.includes("production url")) return "#health";
  if (lower.includes("artifact") || lower.includes("runbook")) return "#artifacts";
  return "#readiness";
}

function evidenceValue(value: boolean | number) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function DecisionIcon({ decision }: { decision: LaunchDecision }) {
  if (decision === "ready") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8.5l3 3 7-7" />
      </svg>
    );
  }
  if (decision === "not_ready") {
    return (
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
      <path d="M8 4v5M8 11.5v.01" />
    </svg>
  );
}

export function LaunchReportCard({
  report,
  loading,
  error,
}: {
  report: ProjectLaunchReport | null;
  loading: boolean;
  error: string;
}) {
  return (
    <section className="panel detail-panel launch-report-panel" aria-labelledby="launch-report-title">
      <div className="eyebrow">Launch Snapshot</div>
      <div className="row launch-report-heading">
        <div>
          <h2 id="launch-report-title">Launch Report</h2>
          <p className="launch-report-intro">
            A current summary of readiness, evidence coverage, blockers, and next launch-review actions.
          </p>
        </div>
        {report && <span className={`badge ${decisionTone[report.decision]}`}>{decisionLabels[report.decision]}</span>}
      </div>
      {loading ? (
        <p className="meta" aria-live="polite">
          Loading launch report...
        </p>
      ) : error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : report ? (
        <div className="launch-report-body">
          <div className={`status-band tone-${decisionTone[report.decision]}`}>
            <span className="status-icon" aria-hidden="true">
              <DecisionIcon decision={report.decision} />
            </span>
            <div>
              <strong className="status-headline">{report.headline}</strong>
              <p className="status-sub">
                {report.readiness.score === null ? "No readiness score yet" : `${report.readiness.score}/100 readiness`}
                {" · "}
                Generated {formatDate(report.generated_at)}
              </p>
            </div>
          </div>
          <section className="launch-report-section" aria-labelledby="launch-evidence-title">
            <h3 id="launch-evidence-title">Evidence Coverage</h3>
            <dl className="launch-evidence-grid">
              {Object.entries(report.evidence_summary).map(([key, value]) => (
                <div key={key}>
                  <dt>{evidenceLabels[key as keyof ProjectLaunchReport["evidence_summary"]]}</dt>
                  <dd>{evidenceValue(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="launch-report-section" aria-labelledby="launch-blockers-title">
            <h3 id="launch-blockers-title">Blockers</h3>
            {report.blockers.length > 0 ? (
              <ul className="launch-pill-list">
                {report.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="meta">No blockers were returned.</p>
            )}
          </section>
          <section className="launch-report-section" aria-labelledby="launch-actions-title">
            <h3 id="launch-actions-title">Recommended Actions</h3>
            <ol className="launch-action-list">
              {report.recommended_actions.map((action) => (
                <li key={action}>
                  <a className="link" href={actionTarget(action)}>
                    {action}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <p className="meta">No launch report is available yet.</p>
      )}
    </section>
  );
}
