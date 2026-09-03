import { formatDate } from "../../../utils/formatDate";
import type { CommandCenterSummary, CommandCenterTone } from "../utils/projectCommandCenter";

export interface ProjectSummaryCardItem {
  label: string;
  summary: CommandCenterSummary & { scoreLabel?: string; topGap?: string };
}

const TONE_GLYPH: Record<CommandCenterTone, string> = {
  success: "✓",
  warning: "!",
  danger: "×",
  info: "·",
  neutral: "–",
};

function gaugeDisplay(summary: ProjectSummaryCardItem["summary"]) {
  const scoreMatch = summary.scoreLabel?.match(/^(\d+)\/100$/);
  return scoreMatch ? scoreMatch[1] : TONE_GLYPH[summary.tone];
}

function SummaryMeta({ summary }: { summary: ProjectSummaryCardItem["summary"] }) {
  if (!summary.metric && !summary.scoreLabel && !summary.topGap && !summary.timestamp) return null;
  return (
    <span className="summary-meta">
      {summary.metric && <span>{summary.metric}</span>}
      {summary.scoreLabel && <span>{summary.scoreLabel}</span>}
      {summary.topGap && <span>Top gap: {summary.topGap}</span>}
      {summary.timestamp && <span>{formatDate(summary.timestamp)}</span>}
    </span>
  );
}

/** The three signals with a real reading (CodeMap, Health, Readiness) get a ring gauge. */
function GaugeCard({ item }: { item: ProjectSummaryCardItem }) {
  return (
    <a className={`gauge-card tone-${item.summary.tone}`} href={`#${item.summary.targetId}`}>
      <span className="ring" aria-hidden="true">
        {gaugeDisplay(item.summary)}
      </span>
      <span className="gauge-copy">
        <span className="summary-label">{item.label}</span>
        <span className="badge">{item.summary.label}</span>
        <strong>{item.summary.title}</strong>
        <span>{item.summary.detail}</span>
        <SummaryMeta summary={item.summary} />
      </span>
    </a>
  );
}

/** The remaining structural signals (Repository, Launch Decision, Artifacts, Activity) stay quieter. */
function SignalChip({ item }: { item: ProjectSummaryCardItem }) {
  return (
    <a className={`signal-chip tone-${item.summary.tone}`} href={`#${item.summary.targetId}`}>
      <span className="dot" aria-hidden="true" />
      <span className="gauge-copy">
        <span className="summary-label">{item.label}</span>
        <span className="badge">{item.summary.label}</span>
        <strong>{item.summary.title}</strong>
        <span>{item.summary.detail}</span>
        <SummaryMeta summary={item.summary} />
      </span>
    </a>
  );
}

export function ProjectSummaryCards({
  gauges,
  chips,
}: {
  gauges: ProjectSummaryCardItem[];
  chips: ProjectSummaryCardItem[];
}) {
  return (
    <section className="summary-section" aria-label="Project summary cards">
      <div className="gauge-cluster">
        {gauges.map((item) => (
          <GaugeCard item={item} key={item.label} />
        ))}
      </div>
      <div className="signal-chip-row">
        {chips.map((item) => (
          <SignalChip item={item} key={item.label} />
        ))}
      </div>
    </section>
  );
}
