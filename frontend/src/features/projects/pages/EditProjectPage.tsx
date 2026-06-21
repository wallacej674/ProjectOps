import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { projectsApi } from "../../../api/projects";
import { AppShell } from "../../../components/layout/AppShell";
import { ErrorState } from "../../../components/ui/ErrorState";
import { SkeletonPanel } from "../../../components/ui/LoadingSkeleton";
import type { Project } from "../../../types/project";
import { ProjectForm } from "../components/ProjectForm";

/** Edit an existing Project, prepopulated from its current values. */
export function EditProjectPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    projectsApi
      .get(projectId)
      .then(setProject)
      .catch((e: ApiError) => setError(e.message));
  }, [projectId]);

  if (error)
    return (
      <AppShell>
        <div className="content">
          <ErrorState title="Project unavailable">
            <p>{error}</p>
          </ErrorState>
        </div>
      </AppShell>
    );
  if (!project)
    return (
      <AppShell>
        <div className="content">
          <SkeletonPanel height={480} />
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Project Dashboard</div>
            <h1>Edit {project.name}</h1>
            <p>Update the Project information used throughout ProjectOps.</p>
          </div>
        </div>
        <ProjectForm
          initial={{
            name: project.name,
            description: project.description,
            repo_url: project.repo_url,
            production_url: project.production_url,
            status: project.status === "archived" ? "paused" : project.status,
          }}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await projectsApi.update(projectId, input);
            navigate(`/app/projects/${projectId}`);
          }}
        />
      </div>
    </AppShell>
  );
}
