import { Link } from "react-router-dom";
import type { Project } from "../../../types/project";
import type { CommandCenterSummary, ProjectNextAction } from "../utils/projectCommandCenter";
import { workspaceHref, type ProjectView } from "../utils/projectWorkspace";
export function ProjectRecordOverview({ project, records, actions }: {
  project: Project;
  records: { area: string; view: ProjectView; summary: CommandCenterSummary; loading: boolean; error: string }[];
  actions: ProjectNextAction[];
}) {
  return <section aria-labelledby="project-record-title" className="project-record">
    <div className="row"><h2 id="project-record-title">Project record</h2><span className="badge">{project.status}</span></div>
    <p className="meta">Latest records across this project. Open an area to inspect its evidence and history.</p>
    <div className="workspace-table-wrap"><table className="workspace-record-table"><thead><tr><th>Area</th><th>Latest record</th><th>Context</th><th><span className="sr-only">Open area</span></th></tr></thead>
      <tbody>{records.map(({ area, view, summary, loading, error }) => <tr key={view}><th scope="row">{area}</th><td className={`workspace-tone-${error ? "danger" : summary.tone}`}>{loading ? "Loading…" : error ? "Unavailable" : summary.label}</td><td>{error || (loading ? "Retrieving project evidence." : summary.detail)}</td><td><Link to={workspaceHref(view)} aria-label={`Open ${area}`}>Open →</Link></td></tr>)}</tbody>
    </table></div>
    <div className="workspace-overview-columns"><section aria-labelledby="workspace-actions-title"><h3 id="workspace-actions-title">Needs attention</h3>{actions.length ? <ul className="workspace-actions">{actions.slice(0, 3).map(action => <li key={action.id}><a href={`#${action.targetId}`}>{action.title}</a><p className="meta">{action.detail}</p></li>)}</ul> : <p className="meta">No next actions were returned for the current project evidence.</p>}</section><aside><h3>About this project</h3><p>{project.description || "No description added."}</p><Link to={workspaceHref("settings")}>Edit project details →</Link><p className="meta">Project #{project.id}</p></aside></div>
  </section>;
}
