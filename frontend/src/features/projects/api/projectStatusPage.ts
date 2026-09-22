import { request } from "../../../api/client";
import type { ProjectStatusPage, ProjectStatusPageUpdateInput } from "../../../types/projectStatusPage";

export const getProjectStatusPage = (projectId: string) =>
  request<ProjectStatusPage>(`/api/v1/projects/${projectId}/status-page`);

export const updateProjectStatusPage = (projectId: string, input: ProjectStatusPageUpdateInput) =>
  request<ProjectStatusPage>(`/api/v1/projects/${projectId}/status-page`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const pauseProjectStatusPage = (projectId: string) =>
  request<ProjectStatusPage>(`/api/v1/projects/${projectId}/status-page`, { method: "DELETE" });

export const rotateProjectStatusPageSlug = (projectId: string) =>
  request<ProjectStatusPage>(`/api/v1/projects/${projectId}/status-page/rotate-slug`, { method: "POST" });
