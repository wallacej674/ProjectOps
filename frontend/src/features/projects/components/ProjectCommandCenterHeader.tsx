import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Project } from "../../../types/project";
import { formatDate } from "../../../utils/formatDate";
import type { CommandCenterSummary, ProjectNextAction } from "../utils/projectCommandCenter";

export function ProjectCommandCenterHeader({
  project,
  repositorySummary,
  healthSummary,
  primaryAction,
  titleId,
  onArchive,
}: {
  project: Project;
  repositorySummary: CommandCenterSummary;
  healthSummary: CommandCenterSummary;
  primaryAction?: ProjectNextAction;
  titleId: string;
  onArchive: () => void;
}) {
  return (
    <div className="command-header">
      <div className="command-title">
        <div className="eyebrow">Project Command Center</div>
        <h1 id={titleId}>{project.name}</h1>
        <p>{project.description || "No description added."}</p>
      </div>
      <dl className="command-facts" aria-label="Project command-center facts">
        <div>
          <dt>Lifecycle</dt>
          <dd>
            <StatusBadge status={project.status} />
          </dd>
        </div>
        <div>
          <dt>Repository</dt>
          <dd>{repositorySummary.label}</dd>
        </div>
        <div>
          <dt>Production URL</dt>
          <dd className="mono">{project.production_url || healthSummary.label}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatDate(project.updated_at)}</dd>
        </div>
      </dl>
      <div className="command-actions">
        {primaryAction && (
          <a className="button primary" href={`#${primaryAction.targetId}`} aria-label={`Primary action: ${primaryAction.title}`}>
            {primaryAction.title}
          </a>
        )}
        <Link className="button" to={`/app/projects/${project.id}/edit`}>
          Edit Project
        </Link>
        <button className="button danger" type="button" onClick={onArchive}>
          Archive Project
        </button>
      </div>
    </div>
  );
}
