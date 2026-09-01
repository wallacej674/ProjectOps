import { request } from "../../../api/client";
import type {
  HealthCheck,
  HealthCheckRunInput,
  HealthMonitorCadence,
  HealthMonitorSchedule,
} from "../../../types/healthCheck";

export const runProjectHealthCheck = (projectId: string, input?: HealthCheckRunInput) =>
  request<HealthCheck>(`/api/v1/projects/${projectId}/health-checks/run`, {
    method: "POST",
    ...(input?.url ? { body: JSON.stringify({ url: input.url }) } : {}),
  });

export const getLatestProjectHealthCheck = (projectId: string) =>
  request<HealthCheck>(`/api/v1/projects/${projectId}/health-checks/latest`);

export const listProjectHealthChecks = (projectId: string) =>
  request<HealthCheck[]>(`/api/v1/projects/${projectId}/health-checks`);

export const getProjectHealthMonitor = (projectId: string) =>
  request<HealthMonitorSchedule>(`/api/v1/projects/${projectId}/health-monitor`);

export const updateProjectHealthMonitor = (
  projectId: string,
  input: { enabled: boolean; cadence_minutes: HealthMonitorCadence },
) => request<HealthMonitorSchedule>(`/api/v1/projects/${projectId}/health-monitor`, {
  method: "PUT",
  body: JSON.stringify(input),
});

export const pauseProjectHealthMonitor = (projectId: string) =>
  request<HealthMonitorSchedule>(`/api/v1/projects/${projectId}/health-monitor`, { method: "DELETE" });
