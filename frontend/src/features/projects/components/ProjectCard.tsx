import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate } from "../../../utils/formatDate";
import type { Project } from "../../../types/project";
import type { ProjectOperationalSnapshot } from "../utils/projectPortfolio";
import { ProjectActionsMenu } from "./ProjectActionsMenu";

function repositoryLabel(url: string | null) {
  if (!url) return "Not connected";
  return url.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
}

/** An operational Project card with its current evidence and recommended setup action. */
export function ProjectCard({
  project,
  snapshot,
  onArchive,
}: {
  project: Project;
  snapshot: ProjectOperationalSnapshot;
  onArchive: (project: Project) => void;
}) {
  const action = !project.repo_url
    ? "Add repository URL"
    : !project.production_url
      ? "Add production URL"
      : "View Dashboard";
  return (
    <article className="panel project-card">
      <div className="row project-card-top">
        <StatusBadge status={project.status} />
        <ProjectActionsMenu
          projectId={project.id}
          onArchive={() => onArchive(project)}
          triggerLabel={`More actions for ${project.name}`}
        />
      </div>
      <div>
        <h2>
          <Link to={`/app/projects/${project.id}`}>{project.name}</Link>
        </h2>
        <p>{project.description || "No description added."}</p>
      </div>
      <p className="project-card-repository mono">{repositoryLabel(project.repo_url)}</p>
      <dl className="project-card-signals">
        <div>
          <dt>Repository</dt>
          <dd>
            <span className={`status-dot ${project.repo_url ? "healthy" : "none"}`} aria-hidden="true" />
            {project.repo_url ? "Connected" : "Missing"}
          </dd>
        </div>
        <div>
          <dt>Health</dt>
          <dd>
            <span className={`status-dot ${snapshot.healthTone}`} aria-hidden="true" />
            {snapshot.healthLabel}
          </dd>
        </div>
        <div>
          <dt>Readiness</dt>
          <dd>
            <span className={`status-dot ${snapshot.readinessTone}`} aria-hidden="true" />
            {snapshot.readinessLabel}
          </dd>
        </div>
      </dl>
      <div className="row project-card-foot">
        <span className="meta">Updated {formatDate(project.updated_at)}</span>
        <Link
          className="project-card-action"
          to={
            project.repo_url || project.production_url
              ? `/app/projects/${project.id}`
              : `/app/projects/${project.id}/edit`
          }
        >
          {action}
        </Link>
      </div>
    </article>
  );
}
