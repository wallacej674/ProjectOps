import { tickerStats } from "./copy";

/** Monospace stat strip under the hero. */
export function StatTicker() {
  return (
    <div className="stat-ticker" aria-label="Platform signals at a glance">
      {tickerStats.map((stat) => (
        <span key={stat.label}>
          <span className="stat-label">{stat.label}</span>
          <span className={`stat-value t-${stat.tone}`}>{stat.value}</span>
        </span>
      ))}
    </div>
  );
}
