import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import type { ProjectReadinessOverview } from "../../types/readiness";
import { listCrossProjectReadiness } from "./api/crossProjectReadiness";
import "./readinessOverview.css";

const statuses = [
  { key: "strong", label: "Strong", hint: "Ready to move forward" },
  { key: "in_progress", label: "In progress", hint: "Building readiness" },
  { key: "needs_work", label: "Needs work", hint: "Focus your next steps" },
  { key: "not_started", label: "Not started", hint: "Awaiting evaluation" },
] as const;

function projectPath(project: ProjectReadinessOverview) {
  return `/app/projects/${project.project_id}#readiness`;
}

function needsAttention(project: ProjectReadinessOverview) {
  return project.score === null || project.failed > 0 || project.unknown > 0 || project.top_gaps.length > 0;
}

/** Latest advisory readiness across the portfolio, with actionable checklist gaps. */
export function ReadinessPage() {
  const [overviews, setOverviews] = useState<ProjectReadinessOverview[] | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");

  useEffect(() => {
    let active = true;
    listCrossProjectReadiness()
      .then((data) => { if (active) setOverviews(data); })
      .catch((e: ApiError) => { if (active) setError({ message: e.message, requestId: e.requestId }); });
    return () => { active = false; };
  }, []);

  const visible = (overviews ?? [])
    .filter((project) => (filter === "all" || project.status === filter)
      && project.project_name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === "score"
      ? (a.score ?? -1) - (b.score ?? -1) || a.project_name.localeCompare(b.project_name)
      : a.project_name.localeCompare(b.project_name));
  const attention = visible.filter(needsAttention);
  const evaluated = overviews?.filter((project) => project.score !== null).length ?? 0;

  function clearFilters() {
    setFilter("all");
    setQuery("");
  }

  return (
    <AppShell>
      <section className="content readiness-overview" aria-labelledby="readiness-title">
        <div className="page-head">
          <div>
            <div className="eyebrow">Cross-project monitoring</div>
            <h1 id="readiness-title">Readiness</h1>
            <p>A clear view of where your projects stand. Know what’s ready and what needs your attention.</p>
          </div>
          {overviews && overviews.length > 0 && (
            <div className="ro-coverage"><span className="ro-coverage-dot" aria-hidden="true" />
              {evaluated} of {overviews.length} projects evaluated
            </div>
          )}
        </div>
        {error ? (
          <ErrorState title="Readiness could not load." requestId={error.requestId}><p>{error.message}</p></ErrorState>
        ) : overviews === null ? (
          <p className="meta" role="status">Loading readiness...</p>
        ) : overviews.length === 0 ? (
          <EmptyState title="No projects yet.">
            <p>Create a Project and run a readiness evaluation to see its advisory score here.</p>
          </EmptyState>
        ) : (
          <>
            <div className="ro-summary" role="group" aria-label="Filter by readiness status">
              {statuses.map(({ key, label, hint }) => (
                <button type="button" key={key} className={`ro-stat ro-${key}`}
                  aria-pressed={filter === key} onClick={() => setFilter(filter === key ? "all" : key)}>
                  <span className="ro-stat-label"><span className="ro-dot" aria-hidden="true" />{label}
                    <span className="ro-stat-arrow" aria-hidden="true">↗</span>
                  </span>
                  <strong>{overviews.filter((project) => project.status === key).length}</strong>
                  <span className="ro-stat-hint">{hint}</span>
                </button>
              ))}
            </div>
            <div className={`ro-workspace ${attention.length ? "ro-with-attention" : ""}`}>
              <div className="ro-portfolio">
                <div className="ro-section-heading">
                  <div><h2>Project readiness <span className="ro-count">{overviews.length}</span></h2>
                    <p>Compare scores and open a project to review its checklist.</p></div>
                  <button type="button" className="ro-all" aria-pressed={filter === "all" && !query} onClick={clearFilters}>All projects</button>
                </div>
                <div className="ro-toolbar">
                  <label className="ro-search"><span className="sr-only">Search projects</span>
                    <input type="search" placeholder="Search projects…" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <label className="ro-sort"><span>Sort by</span>
                    <select value={sort} onChange={(event) => setSort(event.target.value)}>
                      <option value="name">Project name</option><option value="score">Lowest score first</option>
                    </select>
                  </label>
                </div>
                <p className="ro-results" role="status">Showing {visible.length} of {overviews.length} projects{filter !== "all" ? ` · ${statuses.find((status) => status.key === filter)?.label}` : ""}</p>
                {visible.length === 0 ? (
                  <div className="ro-no-results"><h3>No matching projects</h3><p>Try another status or search term.</p>
                    <button type="button" className="button" onClick={clearFilters}>Clear filters</button>
                  </div>
                ) : (
                  <div className="ro-table-scroll">
                    <table className="ro-table" aria-label="Project readiness status">
                      <thead><tr><th scope="col">Project</th><th scope="col">Readiness</th><th scope="col">Checklist</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                      <tbody>{visible.map((project) => (
                        <tr key={project.project_id}>
                          <th scope="row"><Link className="ro-project-name" to={projectPath(project)}>{project.project_name}</Link>
                            <span className={`ro-badge ro-${project.status}`}><span className="ro-dot" aria-hidden="true" />{statuses.find((status) => status.key === project.status)?.label ?? project.status}</span>
                          </th>
                          <td>{project.score === null ? (
                            <div className="ro-unevaluated"><span className="ro-no-score" aria-hidden="true">—</span><span>Not evaluated</span></div>
                          ) : (
                            <div className={`ro-score ro-${project.status}`}>
                              <div className="ro-score-value">{project.score}<span>/100</span></div>
                              <progress max={100} value={project.score} aria-label={`${project.project_name} readiness score`} />
                              <span className="ro-score-caption">Advisory score</span>
                            </div>
                          )}</td>
                          <td><div className="ro-checklist">
                            {project.score === null ? <><strong>Start with an evaluation</strong><span>Build your readiness baseline.</span></> : <>
                              <span>{project.passed} of {project.total_applicable} applicable checks passed</span>
                              {project.top_gaps[0] ? <><strong className="ro-review-label">Needs review</strong><span>{project.top_gaps[0]}</span></>
                                : <strong>{project.failed > 0 || project.unknown > 0 ? "Review unresolved checks" : project.total_applicable > 0 ? "All applicable checks passed" : "No applicable checks"}</strong>}
                            </>}
                          </div></td>
                          <td><Link className={`ro-action ${project.score === null ? "ro-action-primary" : ""}`} to={projectPath(project)}
                            aria-label={`${project.score === null ? "Evaluate project" : "View checklist"}: ${project.project_name}`}>
                            {project.score === null ? "Evaluate project" : "View checklist"}<span aria-hidden="true">↗</span>
                          </Link></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                <div className="ro-footnote">Scores are advisory. Open a project for the full checklist and to re-evaluate.</div>
              </div>
              {attention.length > 0 && (
                <aside className="ro-attention" aria-labelledby="ro-attention-title">
                  <div className="ro-attention-heading"><span className="ro-attention-icon" aria-hidden="true">!</span><h2 id="ro-attention-title">Attention needed</h2><span className="ro-count">{attention.length}</span></div>
                  <p>Next steps for the projects in this view.</p>
                  <ul>{attention.map((project) => (
                    <li key={project.project_id}>
                      <span className="ro-attention-kind">{project.score === null ? "Get started" : "Checklist review"}</span>
                      <h3>{project.project_name}</h3>
                      {project.score === null ? <p>Run the first evaluation to see where this project stands.</p> : <>
                        <p>{project.failed} failed · {project.unknown} awaiting evidence</p>
                        {project.top_gaps.length > 0 && <ul className="ro-gaps">{project.top_gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}
                      </>}
                      <Link to={projectPath(project)} aria-label={`${project.score === null ? "Start evaluation" : "Review gaps"}: ${project.project_name}`}>
                        {project.score === null ? "Start evaluation" : "Review gaps"} <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}</ul>
                </aside>
              )}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
