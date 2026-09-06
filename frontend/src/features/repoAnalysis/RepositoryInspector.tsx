import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { usePolledResource } from "../../hooks/usePolledResource";
import { formatDate } from "../../utils/formatDate";
import type { ProjectRepoAnalysisOverview } from "../../types/repoAnalysis";
import { getLatestProjectAnalysis, listProjectAnalyses } from "../projects/api/projectAnalyses";

const views = ["Summary", "Stack & signals", "Evidence", "History"] as const;
function FileList({ title, files }: { title: string; files: string[] }) {
  return <section className="repo-detail-section"><h3>{title}</h3>{files.length ? <ul className="repo-files">{files.map((file, i) => <li key={`${file}-${i}`}><code>{file}</code></li>)}</ul> : <p className="meta">No {title.toLowerCase()} recorded.</p>}</section>;
}

export function RepositoryInspector({ row }: { row: ProjectRepoAnalysisOverview }) {
  const [view, setView] = useState<typeof views[number]>("Summary");
  const load = useCallback(async () => {
    try { return await getLatestProjectAnalysis(String(row.project_id)); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }, [row.project_id]);
  const latest = usePolledResource(load, Boolean(row.repo_owner));
  const loadHistory = useCallback(() => listProjectAnalyses(String(row.project_id)), [row.project_id]);
  const history = usePolledResource(loadHistory, view === "History");
  const analysis = latest.data;
  return <section className="repo-inspector" id="repository-inspector" aria-labelledby="selected-repository-title">
    <header className="repo-inspector-header"><div><p className="meta">{row.repo_owner ? `${row.repo_owner}/${row.repo_name}` : "Repository not connected"}</p><h2 id="selected-repository-title">{row.project_name}</h2></div><Link className="button" to={`/app/projects/${row.project_id}?view=repository`}>{row.repo_owner ? "Manage repository" : "Connect repository"}</Link></header>
    <nav className="repo-detail-nav" aria-label="Analysis sections">{views.map(name => <button key={name} aria-pressed={view === name} onClick={() => setView(name)}>{name}</button>)}</nav>
    {latest.error && <p role="alert">Latest analysis could not refresh. Displayed data may be stale. {latest.error}</p>}
    {view === "History" ? <section aria-label="Analysis history"><div className="repo-inspector-header"><h3>Analysis history</h3><button className="button compact" onClick={() => void history.refresh()}>Refresh history</button></div>{history.error && <p role="alert">History could not refresh. {history.error}</p>}{!history.data ? <p className="meta">{history.error ? "History unavailable." : "Loading history..."}</p> : !history.data.length ? <p className="meta">No analysis history yet.</p> : <ol className="repo-history">{history.data.map(item => <li key={item.id}><details><summary><strong>{item.status}</strong><span>{item.total_files_scanned} files</span><span>{formatDate(item.created_at)}</span></summary><p>{item.summary || "No summary recorded."}</p>{item.error_message && <p>{item.error_message}</p>}{item.warnings?.map((warning, i) => <p key={i}>{warning}</p>)}</details></li>)}</ol>}</section> : <>
      {!row.repo_owner ? <div className="repo-empty"><h3>Connect a repository to start</h3><p>Once connected, run an analysis to discover the stack and inspect the files behind its findings.</p></div> : latest.loading ? <p className="meta">Loading analysis details...</p> : <>
        {view === "Summary" && <section aria-label="Analysis summary">
          <div className="repo-analysis-facts"><div><span>Latest scan</span><strong>{analysis?.status ?? row.latest_status ?? "Not analyzed"}</strong></div><div><span>Files scanned</span><strong>{analysis ? `${analysis.total_files_scanned} files` : row.total_files_scanned !== null ? `${row.total_files_scanned} files` : "Not available"}</strong></div><div><span>Analyzed</span><strong>{analysis?.created_at ? formatDate(analysis.created_at) : row.analyzed_at ? formatDate(row.analyzed_at) : "Not yet"}</strong></div></div>
          <h3>What the scan found</h3><p className="repo-summary">{analysis?.summary ?? row.summary ?? "No analysis summary yet. Open the project to run a scan."}</p>
          {analysis?.error_message && <p role="alert">{analysis.error_message}</p>}
          <section className="repo-detail-section"><h3>Warnings</h3>{analysis ? analysis.warnings.length ? <ul>{analysis.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul> : <p className="meta">No warnings recorded in this scan.</p> : <p className="meta">Warnings are available when analysis details load.</p>}</section>
          <p className="repo-method">Findings are inferred from repository paths and selected manifests. A completed scan does not establish production readiness.</p>
        </section>}
        {view !== "Summary" && !analysis && <p className="meta">{latest.error ? "Analysis details unavailable." : "No analysis details yet. Open the project to run a scan."}</p>}
        {view === "Stack & signals" && analysis && <section aria-label="Stack and signals">
          <h3>Detected stack</h3>{Object.keys(analysis.detected_stack).length ? Object.entries(analysis.detected_stack).map(([group, values]) => <div className="repo-stack-group" key={group}><h4>{group.replaceAll("_", " ")}</h4><div className="repo-tags">{values.map(value => <span key={value}>{value}</span>)}</div></div>) : <p className="meta">No stack detected.</p>}
          {analysis.insights && <section className="repo-detail-section"><h3>Repository insights</h3>{["runtimes", "frameworks", "package_managers", "operational_signals"].map(key => { const values = analysis.insights?.[key as "runtimes"]; return values?.length ? <div className="repo-stack-group" key={key}><h4>{key.replaceAll("_", " ")}</h4><div className="repo-tags">{values.map(value => <span key={value}>{value}</span>)}</div></div> : null; })}{analysis.insights.dependency_counts && <p>{analysis.insights.dependency_counts.runtime} runtime dependencies · {analysis.insights.dependency_counts.development} development dependencies</p>}</section>}
          <section className="repo-detail-section"><h3>Architecture signals</h3><dl className="repo-signal-list">{Object.entries(analysis.signals).map(([name, detected]) => <div key={name}><dt>{name.replace(/^has_/, "").replaceAll("_", " ")}</dt><dd>{detected ? "Detected" : "Not detected"}</dd></div>)}</dl>{!Object.keys(analysis.signals).length && <p className="meta">No signals recorded.</p>}</section>
          {analysis.insights?.commands && <section className="repo-detail-section"><h3>Declared commands</h3>{Object.entries(analysis.insights.commands).map(([name, commands]) => <div className="repo-stack-group" key={name}><h4>{name}</h4>{commands.map(command => <pre key={command}>{command}</pre>)}</div>)}</section>}
        </section>}
        {view === "Evidence" && analysis && <section aria-label="Analysis evidence"><FileList title="Inspected files" files={analysis.inspected_files ?? []} /><section className="repo-detail-section"><h3>Finding sources</h3>{Object.entries(analysis.evidence_files ?? {}).map(([finding, paths]) => <details className="repo-source" key={finding}><summary>{finding}</summary><ul className="repo-files">{paths.map((path, i) => <li key={i}><code>{path}</code></li>)}</ul></details>)}{!Object.keys(analysis.evidence_files ?? {}).length && <p className="meta">No finding sources recorded.</p>}</section><FileList title="Detected files" files={analysis.detected_files} /><FileList title="Detected folders" files={analysis.detected_folders} /></section>}
      </>}
    </>}
  </section>;
}
