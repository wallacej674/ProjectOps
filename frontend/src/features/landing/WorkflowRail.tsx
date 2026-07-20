import { workflow } from "./copy";

/** Numbered five-step rail describing the real project lifecycle. */
export function WorkflowRail() {
  return (
    <div className="workflow-rail">
      {workflow.steps.map((step, index) => (
        <article className="workflow-step" key={step.title}>
          <span className="workflow-num" aria-hidden="true">
            0{index + 1}
          </span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
