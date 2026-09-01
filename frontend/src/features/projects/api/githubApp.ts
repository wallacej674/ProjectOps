import { request } from "../../../api/client";
import type { RepoIntegration } from "../../../types/repoIntegration";

export interface GitHubAppStatus { enabled: boolean; authorize_url: string | null }
export interface GitHubRepositoryChoice {
  id: number; installation_id: number; full_name: string; html_url: string;
  default_branch: string | null; private: boolean;
}

export const getGitHubAppAuthorization = (projectId: string) =>
  request<GitHubAppStatus>(`/api/v1/projects/${projectId}/github-app/authorize`);

export const completeGitHubAppAuthorization = (code: string, state: string) =>
  request<{ project_id: number; installation_count: number }>("/api/v1/projects/github-app/callback", {
    method: "POST", body: JSON.stringify({ code, state }),
  });

export const listGitHubAppRepositories = (projectId: string) =>
  request<GitHubRepositoryChoice[]>(`/api/v1/projects/${projectId}/github-app/repositories`);

export const attachGitHubAppRepository = (projectId: string, installationId: number, repositoryId: number) =>
  request<RepoIntegration>(`/api/v1/projects/${projectId}/github-app/repo`, {
    method: "POST", body: JSON.stringify({ installation_id: installationId, repository_id: repositoryId }),
  });
