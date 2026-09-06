import type { OverviewPortfolioModel } from "../utils/overviewPortfolio";

export function PortfolioStatus({
  model,
  lastUpdatedAt,
  refreshing,
  onRefresh,
}: {
  model: OverviewPortfolioModel;
  lastUpdatedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const hasAttention = model.needsAttentionCount > 0;
  const title =
    model.activeCount === 0
      ? "No active projects yet"
      : hasAttention
        ? `${model.needsAttentionCount} project${model.needsAttentionCount === 1 ? " needs" : "s need"} attention`
        : "All projects operational";
  const detail = hasAttention
    ? `${model.criticalCount} critical and ${model.needsAttentionCount - model.criticalCount} warning signal${model.needsAttentionCount - model.criticalCount === 1 ? "" : "s"}.`
    : model.activeCount > 0
      ? "No active project currently has an operational blocker."
      : "Create a project to begin tracking operational evidence.";
  const updatedLabel = lastUpdatedAt
    ? `Updated ${new Date(lastUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Updating portfolio data";

  return (
    <>
      <section
        className={`overview-status-banner panel ${hasAttention ? "attention" : "operational"}`}
        aria-labelledby="portfolio-status-title"
      >
        <div className="overview-status-icon" aria-hidden="true">
          {hasAttention ? "!" : "✓"}
        </div>
        <div className="overview-status-copy">
          <div className="eyebrow">Portfolio status</div>
          <h2 id="portfolio-status-title">{title}</h2>
          <p>{detail}</p>
        </div>
        <div className="overview-status-tools">
          <span className="overview-updated-at" aria-live="polite">
            {refreshing ? "Refreshing portfolio data" : updatedLabel}
          </span>
          <button
            type="button"
            className="overview-status-refresh"
            aria-label="Refresh portfolio data"
            title="Refresh portfolio data"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <svg
              viewBox="0 0 16 16"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M13.1 6.2A5.3 5.3 0 1 0 13 10.1" />
              <path d="M13.2 2.8v3.6H9.6" />
            </svg>
          </button>
        </div>
      </section>
      <section className="overview-metric-strip" aria-label="Portfolio metrics">
        <div>
          <span>Active</span>
          <strong>{model.activeCount}</strong>
          <small>Current projects</small>
        </div>
        <div className="healthy">
          <span>Healthy</span>
          <strong>{model.healthyCount}</strong>
          <small>Latest check passed</small>
        </div>
        <div className={hasAttention ? "attention" : ""}>
          <span>Needs attention</span>
          <strong>{model.needsAttentionCount}</strong>
          <small>Actionable projects</small>
        </div>
        <div className={model.missingSetupCount > 0 ? "attention" : ""}>
          <span>Missing setup</span>
          <strong>{model.missingSetupCount}</strong>
          <small>Repository or target</small>
        </div>
      </section>
    </>
  );
}
