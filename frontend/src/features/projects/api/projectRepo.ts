import { request } from "../../../api/client";
import type { RepoIntegration, RepoIntegrationInput } from "../../../types/repoIntegration";

export const getProjectRepo = (projectId: string) =>
  request<RepoIntegration>(`/api/v1/projects/${projectId}/repo`);

export const attachProjectRepo = (projectId: string, input: RepoIntegrationInput) =>
  request<RepoIntegration>(`/api/v1/projects/${projectId}/repo`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const removeProjectRepo = (projectId: string) =>
  request<void>(`/api/v1/projects/${projectId}/repo`, { method: "DELETE" });
