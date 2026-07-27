import { request } from "../../../api/client";
import type { RepoAnalysis } from "../../../types/repoAnalysis";

export const runProjectAnalysis = (projectId: string) =>
  request<RepoAnalysis>(`/api/v1/projects/${projectId}/analyses/run`, { method: "POST" });

export const getLatestProjectAnalysis = (projectId: string) =>
  request<RepoAnalysis>(`/api/v1/projects/${projectId}/analyses/latest`);

export const listProjectAnalyses = (projectId: string) =>
  request<RepoAnalysis[]>(`/api/v1/projects/${projectId}/analyses`);
