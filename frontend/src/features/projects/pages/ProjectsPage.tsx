import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { projectsApi } from "../../../api/projects";
import { AppShell } from "../../../components/layout/AppShell";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { SkeletonCards } from "../../../components/ui/LoadingSkeleton";
import type { ProjectView } from "../../../components/ui/ViewToggle";
import type { ProjectHealthSummary } from "../../../types/healthCheck";
import type { Project } from "../../../types/project";
import type { ProjectReadinessOverview } from "../../../types/readiness";
import { listCrossProjectHealth } from "../../health/api/crossProjectHealth";
import { listCrossProjectReadiness } from "../../readiness/api/crossProjectReadiness";
import { ArchiveProjectModal } from "../components/ArchiveProjectModal";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectFilters } from "../components/ProjectFilters";
import { ProjectPortfolioControls } from "../components/ProjectPortfolioControls";
import { ProjectsTable } from "../components/ProjectsTable";
import { defaultSort, sortProjects } from "../projectSort";
import type { SortKey } from "../projectSort";
import {
  buildProjectOperationalSnapshots,
  matchesProjectSegment,
  summarizeProjectPortfolio,
  type ProjectRegistrySegment,
} from "../utils/projectPortfolio";

type ApiErrorState = {
  message: string;
  requestId?: string;
};

/** The Project Registry: list, search, filter, view switch, and archive. */
export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<ApiErrorState | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>(defaultSort);
  const [segment, setSegment] = useState<ProjectRegistrySegment>("all");
  const [view, setView] = useState<ProjectView>("cards");
  const [archive, setArchive] = useState<Project | null>(null);
  const [healthRows, setHealthRows] = useState<ProjectHealthSummary[]>([]);
  const [readinessRows, setReadinessRows] = useState<ProjectReadinessOverview[]>([]);

  const load = () => {
    setProjects(null);
    setError(null);
    void Promise.allSettled([projectsApi.list(true), listCrossProjectHealth(), listCrossProjectReadiness()]).then(
      ([projectsResult, healthResult, readinessResult]) => {
        if (projectsResult.status === "fulfilled") {
          setProjects(Array.isArray(projectsResult.value) ? projectsResult.value : []);
        } else {
          const failure = projectsResult.reason;
          setError({
            message: failure instanceof Error ? failure.message : "Projects could not load.",
            requestId: failure instanceof ApiError ? failure.requestId : undefined,
          });
        }
        setHealthRows(
          healthResult.status === "fulfilled" && Array.isArray(healthResult.value) ? healthResult.value : [],
        );
        setReadinessRows(
          readinessResult.status === "fulfilled" && Array.isArray(readinessResult.value) ? readinessResult.value : [],
        );
      },
    );
  };
  useEffect(load, []);

  const snapshots = buildProjectOperationalSnapshots(projects ?? [], healthRows, readinessRows);
  const portfolio = summarizeProjectPortfolio(projects ?? [], snapshots);

  const filtered = sortProjects(
    (projects ?? []).filter(
      (p) =>
        matchesProjectSegment(p, snapshots.get(p.id)!, segment) &&
        (status === "all" || p.status === status) &&
        `${p.name} ${p.description || ""} ${p.repo_url || ""} ${p.production_url || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
    sort,
  );

  function selectSegment(nextSegment: ProjectRegistrySegment) {
    setSegment(nextSegment);
    if (nextSegment === "archived") setStatus("all");
  }

  return (
    <AppShell>
      <div className="content">
        <div className="page-head project-registry-head">
          <div>
            <div className="eyebrow">Project Registry</div>
            <h1>Projects</h1>
            <p>Keep project context current before deeper command-center signals are connected.</p>
          </div>
          <Link className="button primary" to="/app/projects/new">
            + Create Project
          </Link>
        </div>
        {error ? (
          <ErrorState title="Projects could not load" requestId={error.requestId}>
            <p>{error.message}</p>
            <button className="button" type="button" onClick={load}>
              Try again
            </button>
          </ErrorState>
        ) : projects === null ? (
          <SkeletonCards />
        ) : (
          <>
            {projects.length > 0 && (
              <>
                <ProjectPortfolioControls summary={portfolio} segment={segment} onSegment={selectSegment} />
                <ProjectFilters
                  query={query}
                  onQuery={setQuery}
                  status={status}
                  onStatus={setStatus}
                  sort={sort}
                  onSort={setSort}
                  statusDisabled={segment === "archived"}
                  view={view}
                  onView={setView}
                />
              </>
            )}
            {filtered.length === 0 ? (
              <EmptyState
                title={
                  projects.length === 0
                    ? "No Projects yet"
                    : segment === "archived"
                      ? "No archived Projects"
                      : segment === "all" && portfolio.active === 0
                        ? "No active Projects"
                        : "No matching Projects"
                }
              >
                <p>
                  {projects.length === 0
                    ? "Create a Project to organize its essential engineering context."
                    : "Try a different project group, search, or lifecycle filter."}
                </p>
                {projects.length === 0 && (
                  <Link className="button primary" to="/app/projects/new">
                    Create Project
                  </Link>
                )}
              </EmptyState>
            ) : view === "cards" ? (
              <div className="project-grid operational-project-grid">
                {filtered.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    snapshot={snapshots.get(project.id)!}
                    onArchive={setArchive}
                  />
                ))}
              </div>
            ) : (
              <ProjectsTable projects={filtered} snapshots={snapshots} onArchive={setArchive} />
            )}
          </>
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
