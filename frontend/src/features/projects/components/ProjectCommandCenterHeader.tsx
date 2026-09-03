import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Project } from "../../../types/project";
import { formatDate } from "../../../utils/formatDate";
import type { CommandCenterSummary, ProjectNextAction } from "../utils/projectCommandCenter";
import { ProjectActionsMenu } from "./ProjectActionsMenu";

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
      <div className="command-title-row">
        <div className="command-title">
          <div className="eyebrow">Project Command Center</div>
          <h1 id={titleId}>{project.name}</h1>
          <p>{project.description || "No description added."}</p>
        </div>
        <div className="command-actions">
          {primaryAction && (
            <a
              className="button primary compact"
              href={`#${primaryAction.targetId}`}
              aria-label={`Primary action: ${primaryAction.title}`}
            >
              {primaryAction.title}
            </a>
          )}
          <ProjectActionsMenu projectId={project.id} onArchive={onArchive} />
        </div>
      </div>
      <dl className="command-metastrip" aria-label="Project command-center facts">
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
    </div>
  );
}
