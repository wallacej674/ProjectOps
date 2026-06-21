import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate } from "../../../utils/formatDate";
import type { Project } from "../../../types/project";

/** A single Project summary card with its recommended next setup action. */
export function ProjectCard({ project, onArchive }: { project: Project; onArchive: (project: Project) => void }) {
  const action = !project.repo_url
    ? "Add repository URL"
    : !project.production_url
      ? "Add production URL"
      : "View Project Dashboard";
  return (
    <article className="panel project-card">
      <div className="row">
        <StatusBadge status={project.status} />
        <button
          className="button archive-card-action"
          type="button"
          aria-label={`Archive ${project.name}`}
          onClick={() => onArchive(project)}
        >
          Archive
        </button>
      </div>
      <div>
        <h2>
          <Link to={`/app/projects/${project.id}`}>{project.name}</Link>
        </h2>
        <p>{project.description || "No description added."}</p>
      </div>
      <div className="meta">
        Repository URL: {project.repo_url ? "added" : "missing"}
        <br />
        Production URL: {project.production_url ? "added" : "missing"}
      </div>
      <div className="row">
        <span className="meta">Updated {formatDate(project.updated_at)}</span>
        <Link
          className="link"
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
