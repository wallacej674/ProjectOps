import { request } from "../../../api/client";
import type { ProjectAlertWebhook, ProjectAlertWebhookUpdateInput } from "../../../types/projectAlertWebhook";

export const getProjectAlertWebhook = (projectId: string) =>
  request<ProjectAlertWebhook>(`/api/v1/projects/${projectId}/alert-webhook`);

export const updateProjectAlertWebhook = (projectId: string, input: ProjectAlertWebhookUpdateInput) =>
  request<ProjectAlertWebhook>(`/api/v1/projects/${projectId}/alert-webhook`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const pauseProjectAlertWebhook = (projectId: string) =>
  request<ProjectAlertWebhook>(`/api/v1/projects/${projectId}/alert-webhook`, { method: "DELETE" });

export const testProjectAlertWebhook = (projectId: string) =>
  request<ProjectAlertWebhook>(`/api/v1/projects/${projectId}/alert-webhook/test`, { method: "POST" });
