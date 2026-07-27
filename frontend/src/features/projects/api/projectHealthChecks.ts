import { request } from "../../../api/client";
import type { HealthCheck, HealthCheckRunInput } from "../../../types/healthCheck";

export const runProjectHealthCheck = (projectId: string, input?: HealthCheckRunInput) =>
  request<HealthCheck>(`/api/v1/projects/${projectId}/health-checks/run`, {
    method: "POST",
    ...(input?.url ? { body: JSON.stringify({ url: input.url }) } : {}),
  });

export const getLatestProjectHealthCheck = (projectId: string) =>
  request<HealthCheck>(`/api/v1/projects/${projectId}/health-checks/latest`);

export const listProjectHealthChecks = (projectId: string) =>
  request<HealthCheck[]>(`/api/v1/projects/${projectId}/health-checks`);
