import { request } from "../../../api/client";
import type { ProjectReadinessItem, ProjectReadinessSummary, ReadinessItemUpdate } from "../../../types/readiness";

export const evaluateProjectReadiness = (projectId: string) =>
  request<ProjectReadinessSummary>(`/api/v1/projects/${projectId}/readiness/evaluate`, { method: "POST" });

export const getProjectReadiness = (projectId: string) =>
  request<ProjectReadinessSummary>(`/api/v1/projects/${projectId}/readiness`);

export const updateProjectReadinessItem = (projectId: string, itemKey: string, input: ReadinessItemUpdate) =>
  request<ProjectReadinessItem>(`/api/v1/projects/${projectId}/readiness/items/${itemKey}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
