import { Link } from "react-router-dom";
import { projectViews, workspaceHref, type ProjectView } from "../utils/projectWorkspace";

export function ProjectSectionNav({ active }: { active: ProjectView }) {
  return (
    <nav className="workspace-nav" aria-label="Project sections">
      {projectViews.map((view) => (
        <Link to={workspaceHref(view)} key={view} aria-current={active === view ? "page" : undefined}>
          {view === "release" ? "Release Readiness" : view[0].toUpperCase() + view.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
