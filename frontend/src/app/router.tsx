import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "../features/landing/LandingPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { CreateProjectPage } from "../features/projects/pages/CreateProjectPage";
import { EditProjectPage } from "../features/projects/pages/EditProjectPage";
import { ProjectDetailPage } from "../features/projects/pages/ProjectDetailPage";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";

/** Top-level route map for ProjectOps. */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<Navigate to="/app/overview" replace />} />
        <Route path="/app/overview" element={<OverviewPage />} />
        <Route path="/app/projects" element={<ProjectsPage />} />
        <Route path="/app/projects/new" element={<CreateProjectPage />} />
        <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/app/projects/:projectId/edit" element={<EditProjectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
