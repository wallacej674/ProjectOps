import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { projectsApi } from "../../../api/projects";
import { AppShell } from "../../../components/layout/AppShell";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { SkeletonCards } from "../../../components/ui/LoadingSkeleton";
import type { ProjectView } from "../../../components/ui/ViewToggle";
import type { Project } from "../../../types/project";
import { ArchiveProjectModal } from "../components/ArchiveProjectModal";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectFilters } from "../components/ProjectFilters";
import { ProjectsTable } from "../components/ProjectsTable";
import { defaultSort, sortProjects } from "../projectSort";
import type { SortKey } from "../projectSort";

/** The Project Registry: list, search, filter, view switch, and archive. */
export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>(defaultSort);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [view, setView] = useState<ProjectView>("cards");
  const [archive, setArchive] = useState<Project | null>(null);

  const load = () => {
    setProjects(null);
    setError("");
    projectsApi
      .list(includeArchived)
      .then(setProjects)
      .catch((e: ApiError) => setError(e.message));
  };
  useEffect(load, [includeArchived]);

  const filtered = sortProjects(
    (projects ?? []).filter(
      (p) =>
        (status === "all" || p.status === status) &&
        `${p.name} ${p.description || ""} ${p.repo_url || ""} ${p.production_url || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
    sort,
  );

  return (
    <AppShell>
      <div className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Project Registry</div>
            <h1>Projects</h1>
            <p>Keep project context current before deeper command-center signals are connected.</p>
          </div>
          <Link className="button primary" to="/app/projects/new">
            + Create Project
          </Link>
        </div>
        <ProjectFilters
          query={query}
          onQuery={setQuery}
          status={status}
          onStatus={setStatus}
          sort={sort}
          onSort={setSort}
          includeArchived={includeArchived}
          onIncludeArchived={setIncludeArchived}
          view={view}
          onView={setView}
        />
        {error ? (
          <ErrorState title="Projects could not load">
            <p>{error}</p>
            <button className="button" type="button" onClick={load}>
              Try again
            </button>
          </ErrorState>
        ) : projects === null ? (
          <SkeletonCards />
        ) : filtered.length === 0 ? (
          <EmptyState title={projects.length === 0 ? "No Projects yet" : "No matching Projects"}>
            <p>
              {projects.length === 0
                ? "Create a Project to organize its essential engineering context."
                : "Try a different search, status, or archived filter."}
            </p>
            {projects.length === 0 && (
              <Link className="button primary" to="/app/projects/new">
                Create Project
              </Link>
            )}
          </EmptyState>
        ) : view === "cards" ? (
          <div className="project-grid">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} onArchive={setArchive} />
            ))}
          </div>
        ) : (
          <ProjectsTable projects={filtered} onArchive={setArchive} />
        )}
        {archive && (
          <ArchiveProjectModal
            project={archive}
            onClose={() => setArchive(null)}
            onSuccess={() => {
              setArchive(null);
              load();
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
