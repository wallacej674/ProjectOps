import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate } from "../../../utils/formatDate";
import type { Project } from "../../../types/project";

/** Dense, scrollable table view of Projects. */
export function ProjectsTable({ projects, onArchive }: { projects: Project[]; onArchive: (project: Project) => void }) {
  return (
    <div className="panel table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Status</th>
            <th scope="col">Repository</th>
            <th scope="col">Production URL</th>
            <th scope="col">Last updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <strong>{project.name}</strong>
                <br />
                <span className="meta">{project.description || "No description"}</span>
              </td>
              <td>
                <StatusBadge status={project.status} />
              </td>
              <td className="mono">{project.repo_url || "Missing"}</td>
              <td className="mono">{project.production_url || "Missing"}</td>
              <td>{formatDate(project.updated_at)}</td>
              <td>
                <Link className="link" to={`/app/projects/${project.id}`}>
                  View
                </Link>{" "}
                |{" "}
                <Link className="link" to={`/app/projects/${project.id}/edit`}>
                  Edit
                </Link>{" "}
                <button className="link" type="button" aria-label={`Archive ${project.name}`} onClick={() => onArchive(project)}>
                  Archive
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
