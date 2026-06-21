import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { AppShell } from "../../components/layout/AppShell";
import { ErrorState } from "../../components/ui/ErrorState";
import { formatDate } from "../../utils/formatDate";
import type { Project } from "../../types/project";

/** Engineering overview: high-level Project metrics and a future-state preview. */
export function OverviewPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    projectsApi
      .list(true)
      .then(setProjects)
      .catch((e: ApiError) => setError(e.message));
  }, []);

  const active = projects?.filter((p) => p.status !== "archived") ?? [];
  const setup = active.filter((p) => !p.repo_url || !p.production_url);
  const metrics: [string, string | number, string][] = [
    ["Active projects", active.length, "Projects not archived"],
    ["Archived projects", projects?.filter((p) => p.status === "archived").length ?? "", "Kept for history"],
    ["Need setup", setup.length, "Missing a repository or production URL"],
    [
      "Recently updated",
      active[0]?.name ?? "",
      active[0] ? `Updated ${formatDate(active[0].updated_at)}` : "No Projects yet",
    ],
  ];

  return (
    <AppShell>
      <div className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Overview</div>
            <h1>Understand what needs attention across every project.</h1>
            <p>Start with project context, then add the evidence needed for production decisions.</p>
          </div>
          <Link to="/app/projects/new" className="button primary">
            + Create Project
          </Link>
        </div>
        {error ? (
          <ErrorState title="Projects could not load">
            <p>{error}</p>
          </ErrorState>
        ) : (
          <>
            <section className="metrics">
              {metrics.map(([label, value, text]) => (
                <article className="panel metric" key={label}>
                  <div className="eyebrow">{label}</div>
                  <div className="value">{projects ? value : ""}</div>
                  <p>{text}</p>
                </article>
              ))}
            </section>
            <section className="panel preview-note">
              <div className="eyebrow">Design preview: coming later</div>
              <h2>The future Project Dashboard</h2>
              <p>
                Repository analysis, health monitoring, and readiness will appear here only after their frontend
                integrations are approved.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
