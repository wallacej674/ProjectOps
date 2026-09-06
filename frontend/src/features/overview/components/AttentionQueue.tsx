import { Link } from "react-router-dom";
import type { AttentionItem } from "../utils/overviewPortfolio";

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  const visibleItems = items.slice(0, 6);
  return (
    <section className="panel overview-attention-panel" aria-labelledby="attention-queue-title">
      <header className="overview-panel-heading">
        <div>
          <div className="eyebrow">Action required</div>
          <h2 id="attention-queue-title">Attention queue</h2>
        </div>
        <span className="overview-panel-count">{items.length}</span>
      </header>
      {visibleItems.length === 0 ? (
        <div className="overview-clear-state">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>No action required</strong>
            <p>Health, setup, and readiness signals are currently clear.</p>
          </div>
        </div>
      ) : (
        <ol className="attention-list">
          {visibleItems.map((item) => (
            <li key={item.projectId}>
              <span className={`attention-severity ${item.severity}`}>{item.severity}</span>
              <div className="attention-copy">
                <Link to={`/app/projects/${item.projectId}`}>{item.projectName}</Link>
                <p>{item.reason}</p>
              </div>
              <Link className="attention-action" to={item.to}>
                {item.actionLabel} <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {items.length > visibleItems.length && (
        <Link className="overview-panel-footer" to="/app/projects">
          View all projects <span aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}
