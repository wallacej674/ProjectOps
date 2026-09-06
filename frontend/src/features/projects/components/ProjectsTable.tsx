import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate } from "../../../utils/formatDate";
import type { Project } from "../../../types/project";
import { getProjectOperationalSnapshot, type ProjectOperationalSnapshot } from "../utils/projectPortfolio";

/** Dense, scrollable table view of Projects. */
export function ProjectsTable({
  projects,
  snapshots,
  onArchive,
}: {
  projects: Project[];
  snapshots: Map<number, ProjectOperationalSnapshot>;
  onArchive: (project: Project) => void;
}) {
  return (
    <div className="panel table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Lifecycle</th>
            <th scope="col">Health</th>
            <th scope="col">Readiness</th>
            <th scope="col">Repository</th>
            <th scope="col">Last updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const snapshot = snapshots.get(project.id) ?? getProjectOperationalSnapshot(project);
            return (
              <tr key={project.id}>
                <td>
                  <strong>{project.name}</strong>
                  <br />
                  <span className="meta">{project.description || "No description"}</span>
                </td>
                <td>
                  <StatusBadge status={project.status} />
                </td>
                <td>
                  <span className={`table-signal tone-${snapshot.healthTone}`}>{snapshot.healthLabel}</span>
                </td>
                <td>
                  <span className={`table-signal tone-${snapshot.readinessTone}`}>{snapshot.readinessLabel}</span>
                </td>
                <td className="mono">{project.repo_url ? "Connected" : "Missing"}</td>
                <td>{formatDate(project.updated_at)}</td>
                <td>
                  <Link className="link" to={`/app/projects/${project.id}`}>
                    View
                  </Link>{" "}
                  |{" "}
                  <Link className="link" to={`/app/projects/${project.id}/edit`}>
                    Edit
                  </Link>{" "}
                  <button
                    className="link"
                    type="button"
                    aria-label={`Archive ${project.name}`}
                    onClick={() => onArchive(project)}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
