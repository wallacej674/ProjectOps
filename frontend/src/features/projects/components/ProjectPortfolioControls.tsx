import type { ProjectPortfolioSummary, ProjectRegistrySegment } from "../utils/projectPortfolio";

const segments: { id: ProjectRegistrySegment; label: string; count: keyof ProjectPortfolioSummary }[] = [
  { id: "all", label: "All active", count: "active" },
  { id: "attention", label: "Needs attention", count: "needsAttention" },
  { id: "healthy", label: "Healthy", count: "healthy" },
  { id: "missing_setup", label: "Missing setup", count: "missingSetup" },
  { id: "archived", label: "Archived", count: "archived" },
];

export function ProjectPortfolioControls({
  summary,
  segment,
  onSegment,
}: {
  summary: ProjectPortfolioSummary;
  segment: ProjectRegistrySegment;
  onSegment: (segment: ProjectRegistrySegment) => void;
}) {
  return (
    <>
      <section className="portfolio-strip" aria-label="Project portfolio summary">
        <div>
          <span>Total projects</span>
          <strong>{summary.total}</strong>
          <small>Active portfolio</small>
        </div>
        <div className={summary.needsAttention > 0 ? "attention" : ""}>
          <span>Needs attention</span>
          <strong>{summary.needsAttention}</strong>
          <small>Setup or evidence gaps</small>
        </div>
        <div className={summary.healthy > 0 ? "healthy" : ""}>
          <span>Healthy</span>
          <strong>{summary.healthy}</strong>
          <small>Latest check passed</small>
        </div>
        <div className={summary.missingSetup > 0 ? "attention" : ""}>
          <span>Missing setup</span>
          <strong>{summary.missingSetup}</strong>
          <small>Repository or target</small>
        </div>
      </section>

      <nav className="project-segments" aria-label="Project groups">
        {segments.map((item) => (
          <button
            type="button"
            aria-pressed={segment === item.id}
            onClick={() => onSegment(item.id)}
            key={item.id}
          >
            {item.label} <span>{summary[item.count]}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
