import { formatDate } from "../../../utils/formatDate";
import type { CommandCenterSummary } from "../utils/projectCommandCenter";

export interface ProjectSummaryCardItem {
  label: string;
  summary: CommandCenterSummary & { scoreLabel?: string; topGap?: string };
}

export function ProjectSummaryCards({ items }: { items: ProjectSummaryCardItem[] }) {
  return (
    <section className="summary-grid" aria-label="Project summary cards">
      {items.map((item) => (
        <a className={`summary-card ${item.summary.tone}`} href={`#${item.summary.targetId}`} key={item.label}>
          <span className="summary-label">{item.label}</span>
          <span className="badge">{item.summary.label}</span>
          <strong>{item.summary.title}</strong>
          <span>{item.summary.detail}</span>
          {(item.summary.metric || item.summary.scoreLabel || item.summary.timestamp || item.summary.topGap) && (
            <span className="summary-meta">
              {item.summary.metric && <span>{item.summary.metric}</span>}
              {item.summary.scoreLabel && <span>{item.summary.scoreLabel}</span>}
              {item.summary.topGap && <span>Top gap: {item.summary.topGap}</span>}
              {item.summary.timestamp && <span>{formatDate(item.summary.timestamp)}</span>}
            </span>
          )}
        </a>
      ))}
    </section>
  );
}
