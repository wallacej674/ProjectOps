import { useNavigate } from "react-router-dom";
import { projectsApi } from "../../../api/projects";
import { AppShell } from "../../../components/layout/AppShell";
import { ProjectForm } from "../components/ProjectForm";

/** Create a new Project, then route to its detail page. */
export function CreateProjectPage() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="content form-page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Project Registry</div>
            <h1>Create Project</h1>
            <p>Start with the context your team already knows. More command-center evidence can follow.</p>
          </div>
        </div>
        <ProjectForm
          submitLabel="Create Project"
          onSubmit={async (input) => {
            const project = await projectsApi.create(input);
            navigate(`/app/projects/${project.id}`);
          }}
        />
      </div>
    </AppShell>
  );
}
