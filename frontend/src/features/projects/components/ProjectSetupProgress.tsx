import type { ProjectSetupStep } from "../utils/projectCommandCenter";

const statusLabels: Record<ProjectSetupStep["status"], string> = {
  complete: "Complete",
  incomplete: "Incomplete",
  needs_attention: "Needs attention",
};

export function ProjectSetupProgress({ steps }: { steps: ProjectSetupStep[] }) {
  return (
    <section className="command-panel setup-progress" aria-labelledby="setup-progress-title">
      <div className="eyebrow">Setup progress</div>
      <h2 id="setup-progress-title">Project setup</h2>
      <ol className="setup">
        {steps.map((step) => (
          <li className={`setup-item ${step.status}`} key={step.id}>
            <span aria-hidden="true">{step.status === "complete" ? "+" : step.status === "needs_attention" ? "!" : ""}</span>
            <div>
              <div className="setup-row">
                <strong>{step.label}</strong>
                <a href={`#${step.targetId}`}>{statusLabels[step.status]}</a>
              </div>
              <div className="meta">{step.detail}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
