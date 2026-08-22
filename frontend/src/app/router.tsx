import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { AuthPage } from "../features/auth/AuthPage";
import { ProtectedRoute, PublicOnlyRoute } from "../features/auth/ProtectedRoute";
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
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicOnlyRoute><AuthPage mode="login" /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><AuthPage mode="register" /></PublicOnlyRoute>} />
          <Route path="/app" element={<ProtectedRoute><Navigate to="/app/overview" replace /></ProtectedRoute>} />
          <Route path="/app/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="/app/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/app/projects/new" element={<ProtectedRoute><CreateProjectPage /></ProtectedRoute>} />
          <Route path="/app/projects/:projectId" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
          <Route path="/app/projects/:projectId/edit" element={<ProtectedRoute><EditProjectPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
