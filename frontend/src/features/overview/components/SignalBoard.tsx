import { Link } from "react-router-dom";
import type { SignalSummary } from "../utils/signalBoard";

interface SignalBoardItem {
  label: string;
  to: string;
  summary: SignalSummary;
}

function SignalTile({ item }: { item: SignalBoardItem }) {
  const { summary, label, to } = item;
  const activeBuckets = summary.buckets.filter((bucket) => bucket.count > 0);

  return (
    <Link className="coverage-item" to={to}>
      <div className="st-label">
        {label}
        <span className="arrow" aria-hidden="true">
          &#8594;
        </span>
      </div>
      {summary.total === 0 ? (
        <p className="st-empty">No projects yet.</p>
      ) : (
        <>
          <div className="dist-bar" aria-hidden="true">
            {activeBuckets.map((bucket) => (
              <span
                className={bucket.tone}
                key={bucket.label}
                style={{ width: `${(bucket.count / summary.total) * 100}%` }}
              />
            ))}
          </div>
          <div className="dist-legend">
            {activeBuckets.map((bucket) => (
              <span key={bucket.label}>
                <i className={bucket.tone} aria-hidden="true" />
                {bucket.count} {bucket.label}
              </span>
            ))}
          </div>
        </>
      )}
    </Link>
  );
}

/** Cross-project monitoring at a glance: Health, Readiness, Repository Analysis, Artifacts. */
export function SignalBoard({ items }: { items: SignalBoardItem[] }) {
  return (
    <section className="panel operational-coverage" aria-labelledby="operational-coverage-title">
      <header className="overview-panel-heading">
        <div>
          <div className="eyebrow">Supporting evidence</div>
          <h2 id="operational-coverage-title">Operational coverage</h2>
        </div>
        <p>Health, readiness, source context, and artifacts in one view.</p>
      </header>
      <div className="coverage-grid">
        {items.map((item) => (
          <SignalTile item={item} key={item.label} />
        ))}
      </div>
    </section>
  );
}
