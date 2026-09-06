import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import type { ProjectArtifact, ProjectArtifactOverview } from "../../types/projectArtifact";
import { formatDate } from "../../utils/formatDate";
import { listProjectArtifacts } from "../projects/api/projectArtifacts";
import { listCrossProjectArtifactsOverview } from "./api/crossProjectArtifacts";
import "./artifactsLibrary.css";

type LibraryArtifact = ProjectArtifact & { project_name: string };
const types = ["note", "document", "link", "runbook", "decision", "incident", "requirement", "risk", "evidence", "other"];
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
const tags = (value: string | null) => [...new Set(value?.split(",").map(tag => tag.trim()).filter(Boolean) ?? [])];

function ArtifactReader({ artifact, onClose }: { artifact: LibraryArtifact; onClose: () => void }) {
  const ref = useFocusTrap<HTMLElement>(true, onClose);
  const safeUrl = artifact.url && /^https?:\/\//i.test(artifact.url) ? artifact.url : null;
  return <div className="modal-backdrop"><section ref={ref} className="modal panel artifact-reader" role="dialog" aria-modal="true" aria-labelledby="artifact-reader-title">
    <div className="artifact-reader-head"><span className="eyebrow">{label(artifact.artifact_type)}</span><button className="button" onClick={onClose}>Close</button></div>
    <h2 id="artifact-reader-title">{artifact.title}</h2>
    <p className="meta">{artifact.project_name} · Updated {formatDate(artifact.updated_at)}</p>
    <div className="artifact-tag-list">{tags(artifact.tags).map(tag => <span key={tag}>{tag}</span>)}</div>
    {artifact.summary && <p className="artifact-reader-summary">{artifact.summary}</p>}
    {artifact.content ? <div className="artifact-reader-content">{artifact.content}</div> : <p className="meta">No written content has been added.</p>}
    <div className="artifact-reader-footer"><span className="meta">Source: {label(artifact.source_type)}</span>
      {safeUrl && <a className="button" href={safeUrl} target="_blank" rel="noopener noreferrer">Open source ↗</a>}
      <Link className="button" to={`/app/projects/${artifact.project_id}?view=artifacts`}>Manage in project →</Link>
    </div>
  </section></div>;
}

export function ArtifactsOverviewPage() {
  const [projects, setProjects] = useState<ProjectArtifactOverview[] | null>(null);
  const [artifacts, setArtifacts] = useState<LibraryArtifact[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("updated");
  const [selected, setSelected] = useState<LibraryArtifact | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const overview = await listCrossProjectArtifactsOverview();
        const results = await Promise.allSettled(overview.map(async item =>
          (await listProjectArtifacts(String(item.project_id))).filter(artifact => artifact.status === "active")
            .map(artifact => ({ ...artifact, project_name: item.project_name })),
        ));
        if (!active) return;
        setProjects(overview);
        setArtifacts(results.flatMap(result => result.status === "fulfilled" ? result.value : []));
        const failed = results.flatMap((result, index) => result.status === "rejected" ? [overview[index].project_name] : []);
        if (failed.length) setError(`Could not load artifacts for ${failed.join(", ")}. Refresh to try again.`);
      } catch (cause) {
        if (active) setError(`Artifacts could not refresh. ${cause instanceof Error ? cause.message : "Please try again."}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [version]);

  const query = search.trim().toLowerCase();
  const visible = artifacts.filter(item => (!project || String(item.project_id) === project) && (!type || item.artifact_type === type)
    && [item.title, item.summary, item.content, item.tags, item.project_name].some(value => value?.toLowerCase().includes(query)))
    .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.title.localeCompare(b.title));

  return <AppShell><section className="content artifacts-library" aria-labelledby="artifacts-overview-title">
    <div className="page-head"><div><div className="eyebrow">Workspace library</div><h1 id="artifacts-overview-title">Artifacts</h1>
      <p>Notes, decisions, runbooks, and evidence. Find the document you need across your projects.</p></div>
      <button className="button" disabled={loading} onClick={() => setVersion(value => value + 1)}>{loading ? "Loading…" : "Refresh library"}</button></div>
    {error && <p role="alert" className="error-text">{error}</p>}
    {projects !== null && <>
      <div className="artifact-library-bar"><strong>All artifacts <span>{artifacts.length}</span></strong><span className="meta">Across {projects.length} projects</span></div>
      <div className="artifact-library-filters">
        <div className="artifact-search"><label htmlFor="artifact-search">Search library</label><input id="artifact-search" className="control" type="search" placeholder="Search titles, content, or tags" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div><label htmlFor="artifact-project">Project</label><select id="artifact-project" className="control" value={project} onChange={event => setProject(event.target.value)}><option value="">All projects</option>{projects.map(item => <option key={item.project_id} value={item.project_id}>{item.project_name}</option>)}</select></div>
        <div><label htmlFor="artifact-type">Type</label><select id="artifact-type" className="control" value={type} onChange={event => setType(event.target.value)}><option value="">All types</option>{types.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div>
        <div><label htmlFor="artifact-sort">Sort by</label><select id="artifact-sort" className="control" value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="title">Title A–Z</option></select></div>
      </div>
      {visible.length > 0 ? <div className="artifact-table-wrap" role="region" aria-label="Artifact library" tabIndex={0}><table className="artifact-library-table">
        <thead><tr><th scope="col">Title</th><th scope="col">Project</th><th scope="col">Type</th><th scope="col">Tags</th><th scope="col">Updated</th></tr></thead>
        <tbody>{visible.map(item => <tr key={item.id}><td><button className="artifact-title" onClick={() => setSelected(item)}>{item.title}</button><p className="artifact-row-summary">{item.summary || item.url || ""}</p></td>
          <td><Link to={`/app/projects/${item.project_id}?view=artifacts`}>{item.project_name}</Link></td><td><span className="artifact-type">{label(item.artifact_type)}</span></td>
          <td><div className="artifact-tag-list">{tags(item.tags).slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}{tags(item.tags).length > 2 && <span>+{tags(item.tags).length - 2}</span>}{!tags(item.tags).length && <span className="artifact-no-tags">—</span>}</div></td>
          <td><time dateTime={item.updated_at}>{formatDate(item.updated_at)}</time></td></tr>)}</tbody>
      </table></div> : <div className="artifact-library-empty"><h2>{error ? "Some artifacts are unavailable" : projects.length === 0 ? "No projects yet" : artifacts.length === 0 ? "Your library is ready for its first artifact" : "No matching artifacts"}</h2>
        <p>{error ? "Use Refresh library to retry loading the missing records." : artifacts.length === 0 ? "Add a note, link, or runbook from a project's Artifacts section." : "Try a different search or clear your filters."}</p>
        {(search || project || type) && <button className="button" onClick={() => { setSearch(""); setProject(""); setType(""); }}>Clear filters</button>}
        {!artifacts.length && !error && <Link className="button" to="/app/projects">Browse projects →</Link>}
      </div>}
      <p className="meta artifact-library-count" aria-live="polite">Showing {visible.length} of {artifacts.length} loaded artifacts{error ? " · Incomplete results" : ""}</p>
    </>}
    {projects === null && !loading && error && <p>Library unavailable. Try refreshing.</p>}
    {selected && <ArtifactReader artifact={selected} onClose={() => setSelected(null)} />}
  </section></AppShell>;
}
