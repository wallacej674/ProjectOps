import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "../components/layout/BreadcrumbContext";
import { ArtifactsOverviewPage } from "../features/artifactsOverview/ArtifactsOverviewPage";
import { AuthProvider } from "../features/auth/AuthContext";
import { AuthPage } from "../features/auth/AuthPage";
import { ProtectedRoute, PublicOnlyRoute } from "../features/auth/ProtectedRoute";
import { HealthMonitoringPage } from "../features/health/HealthMonitoringPage";
import { LandingPage } from "../features/landing/LandingPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { ReadinessPage } from "../features/readiness/ReadinessPage";
import { RepoAnalysisPage } from "../features/repoAnalysis/RepoAnalysisPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { CreateProjectPage } from "../features/projects/pages/CreateProjectPage";
import { EditProjectPage } from "../features/projects/pages/EditProjectPage";
import { ProjectDetailPage } from "../features/projects/pages/ProjectDetailPage";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";
import { GitHubAppCallbackPage } from "../features/projects/pages/GitHubAppCallbackPage";

/** Top-level route map for ProjectOps. */
export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BreadcrumbProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicOnlyRoute><AuthPage mode="login" /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><AuthPage mode="register" /></PublicOnlyRoute>} />
            <Route path="/app" element={<ProtectedRoute><Navigate to="/app/overview" replace /></ProtectedRoute>} />
            <Route path="/app/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
            <Route path="/app/health" element={<ProtectedRoute><HealthMonitoringPage /></ProtectedRoute>} />
            <Route path="/app/readiness" element={<ProtectedRoute><ReadinessPage /></ProtectedRoute>} />
            <Route path="/app/repository-analysis" element={<ProtectedRoute><RepoAnalysisPage /></ProtectedRoute>} />
            <Route path="/app/artifacts" element={<ProtectedRoute><ArtifactsOverviewPage /></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/app/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
            <Route path="/app/projects/new" element={<ProtectedRoute><CreateProjectPage /></ProtectedRoute>} />
            <Route path="/app/projects/:projectId" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="/app/projects/:projectId/edit" element={<ProtectedRoute><EditProjectPage /></ProtectedRoute>} />
            <Route path="/app/github/callback" element={<ProtectedRoute><GitHubAppCallbackPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BreadcrumbProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
