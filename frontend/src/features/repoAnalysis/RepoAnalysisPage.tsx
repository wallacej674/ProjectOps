import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatDate } from "../../utils/formatDate";
import { AppShell } from "../../components/layout/AppShell";
import { usePolledResource } from "../../hooks/usePolledResource";
import { listCrossProjectRepoAnalysis } from "./api/crossProjectRepoAnalysis";
import { RepositoryInspector } from "./RepositoryInspector";
import type { ProjectRepoAnalysisOverview } from "../../types/repoAnalysis";
import "./repositoryExplorer.css";

function repositoryStatus(row: ProjectRepoAnalysisOverview) {
  return !row.repo_owner ? "Not connected" : row.latest_status === "completed" ? "Completed" : row.latest_status === "failed" ? "Failed" : "Not analyzed";
}

export function RepoAnalysisPage() {
  const { data: rows, error, refresh } = usePolledResource(listCrossProjectRepoAnalysis);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All repositories");
  const [params, setParams] = useSearchParams();
  const visible = rows?.filter(row => (status === "All repositories" || repositoryStatus(row) === status) && `${row.project_name} ${row.repo_owner ?? ""}/${row.repo_name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const selected = rows?.find(row => String(row.project_id) === params.get("project"));
  return <AppShell><section className="content repository-explorer" aria-labelledby="repo-analysis-title">
    <div className="page-head"><div><div className="eyebrow">Repository intelligence</div><h1 id="repo-analysis-title">Repository Analysis</h1><p>Explore the latest scan, detected stack, and supporting evidence for each project.</p></div><button className="button" onClick={() => void refresh()}>Refresh repositories</button></div>
    {error && <p role="alert">Repository Analysis could not refresh. Displayed data may be stale. {error}</p>}
    {!rows ? <p>{error ? "Repository status unavailable." : "Loading repository analysis..."}</p> : !rows.length ? <p>No projects yet. Create a Project and attach a repository to see its analysis here.</p> : <>
      <div className="repo-counts" aria-label="Repository analysis summary"><span>Projects <strong>{rows.length}</strong></span>{["Completed", "Failed", "Not analyzed", "Not connected"].map(label => <span key={label}>{label} <strong>{rows.filter(row => repositoryStatus(row) === label).length}</strong></span>)}</div>
      {selected ? <div className="repo-report">
        <button className="button ghost repo-back" onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.delete("project"); return next; })}>← All repositories</button>
        <RepositoryInspector key={selected.project_id} row={selected} />
      </div> : <>
        <div className="repo-gallery-filters"><div><label htmlFor="repo-search">Find a repository</label><input id="repo-search" className="control" type="search" placeholder="Project or repository" value={search} onChange={event => setSearch(event.target.value)} /></div><div><label htmlFor="repo-status">Analysis status</label><select id="repo-status" className="control" value={status} onChange={event => setStatus(event.target.value)}>{["All repositories", "Completed", "Failed", "Not analyzed", "Not connected"].map(label => <option key={label}>{label}</option>)}</select></div></div>
        <ol className="repo-gallery" aria-label="Project repository analysis status">{visible.map(row => {
          const technologies = [...new Set(Object.values(row.detected_stack ?? {}).flat())];
          return <li className="repo-gallery-card" key={row.project_id}>
            <div className="repo-card-heading"><span className="repo-card-icon" aria-hidden="true">&lt;/&gt;</span><span className={`repo-state ${repositoryStatus(row).toLowerCase().replaceAll(" ", "-")}`}>{repositoryStatus(row)}</span></div>
            <div><h2>{row.project_name}</h2><p className="repo-choice-path">{row.repo_owner ? `${row.repo_owner}/${row.repo_name}` : "No repository connected"}</p></div>
            <p className="repo-card-summary">{row.summary || (row.repo_owner ? "Run a scan to discover the stack and supporting evidence." : "Connect a repository to start exploring its architecture.")}</p>
            <div className="repo-tags" aria-label={`Detected technologies for ${row.project_name}`}>{technologies.slice(0, 5).map(technology => <span key={technology}>{technology}</span>)}{technologies.length > 5 && <span>+{technologies.length - 5} more</span>}{!technologies.length && <span className="repo-stack-empty">{row.latest_status ? "No stack data available" : "Stack not analyzed"}</span>}</div>
            <div className="repo-card-footer"><div className="repo-card-meta"><span>{row.total_files_scanned !== null ? `${row.total_files_scanned} files` : "No scan yet"}</span><span>{row.analyzed_at ? formatDate(row.analyzed_at) : ""}</span></div>
              {row.repo_owner ? <Link className="button" aria-label={`Explore analysis for ${row.project_name}`} to={`?project=${row.project_id}`}>Explore analysis →</Link> : <Link className="button" to={`/app/projects/${row.project_id}?view=repository`}>Connect repository</Link>}
            </div>
          </li>;
        })}</ol>
        {!visible.length && <p className="repo-empty">No repositories match your filters.</p>}
      </>}
    </>}
  </section></AppShell>;
}
