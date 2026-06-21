import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { projectsApi } from "../../../api/projects";
import { AppShell } from "../../../components/layout/AppShell";
import { ErrorState } from "../../../components/ui/ErrorState";
import { SkeletonPanel } from "../../../components/ui/LoadingSkeleton";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate } from "../../../utils/formatDate";
import type { Project } from "../../../types/project";
import { ArchiveProjectModal } from "../components/ArchiveProjectModal";

/** Single-Project dashboard: identity, metadata, and setup progress. */
export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [archive, setArchive] = useState(false);

  useEffect(() => {
    projectsApi
      .get(projectId)
      .then(setProject)
      .catch((e: ApiError) => setError(e.kind === "not-found" ? "This Project was not found." : e.message));
  }, [projectId]);

  if (error)
    return (
      <AppShell>
        <div className="content">
          <ErrorState title="Project unavailable">
            <p>{error}</p>
            <Link className="button" to="/app/projects">
              Back to Projects
            </Link>
          </ErrorState>
        </div>
      </AppShell>
    );
  if (!project)
    return (
      <AppShell>
        <div className="content">
          <SkeletonPanel height={360} />
        </div>
      </AppShell>
    );

  const setup: [string, boolean][] = [
    ["Project information", true],
    ["Repository URL", Boolean(project.repo_url)],
    ["Production URL", Boolean(project.production_url)],
    ["Repository analysis", false],
    ["Health checks", false],
    ["Readiness evaluation", false],
  ];
  const futureStep = (label: string) =>
    label === "Repository analysis" || label === "Health checks" || label === "Readiness evaluation";

  return (
    <AppShell>
      <div className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Project Dashboard</div>
            <h1>{project.name}</h1>
            <p>{project.description || "No description added."}</p>
          </div>
          <div className="top-actions">
            <Link className="button" to={`/app/projects/${project.id}/edit`}>
              Edit Project
            </Link>
            <button className="button danger" type="button" onClick={() => setArchive(true)}>
              Archive Project
            </button>
          </div>
        </div>
        <div className="detail-grid">
          <section className="panel detail-panel">
            <h2>Project information</h2>
            <dl>
              <div className="definition">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={project.status} />
                </dd>
              </div>
              <div className="definition">
                <dt>Repository URL</dt>
                <dd className="mono">{project.repo_url || "Not added"}</dd>
              </div>
              <div className="definition">
                <dt>Production URL</dt>
                <dd className="mono">{project.production_url || "Not added"}</dd>
              </div>
              <div className="definition">
                <dt>Created</dt>
                <dd>{formatDate(project.created_at)}</dd>
              </div>
              <div className="definition">
                <dt>Last updated</dt>
                <dd>{formatDate(project.updated_at)}</dd>
              </div>
              <div className="definition">
                <dt>Project ID</dt>
                <dd className="mono">{project.id}</dd>
              </div>
            </dl>
          </section>
          <aside className="panel detail-panel">
            <div className="eyebrow">Setup progress</div>
            <h2>Complete project setup to unlock the full command center.</h2>
            <div className="setup">
              {setup.map(([label, done]) => (
                <div className={`setup-item ${done ? "done" : ""}`} key={label}>
                  <span aria-hidden="true">
                    {done && (
                      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                        <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <div className="meta">
                      {done
                        ? "Available from Project data."
                        : futureStep(label)
                          ? "Not shown in this frontend milestone."
                          : "Add this Project metadata to continue setup."}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
        {archive && (
          <ArchiveProjectModal
            project={project}
            onClose={() => setArchive(false)}
            onSuccess={() => navigate("/app/projects")}
          />
        )}
      </div>
    </AppShell>
  );
}
