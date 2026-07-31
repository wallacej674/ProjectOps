import type { ProjectNextAction } from "../utils/projectCommandCenter";

export function ProjectNextActions({ actions }: { actions: ProjectNextAction[] }) {
  return (
    <section className="command-panel next-actions" aria-labelledby="next-actions-title">
      <div className="eyebrow">Recommended Next Actions</div>
      <h2 id="next-actions-title">Next actions</h2>
      {actions.length === 0 ? (
        <p className="meta">No recommended next actions right now.</p>
      ) : (
        <ol>
          {actions.map((action) => (
            <li key={action.id}>
              <a href={`#${action.targetId}`}>{action.title}</a>
              <p>{action.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
