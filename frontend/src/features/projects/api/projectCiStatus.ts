import { request } from "../../../api/client";
import type {
  CiMonitorCadence,
  CiPipelineRun,
  CiStatusMonitorSchedule,
  CiSyncResult,
} from "../../../types/ciPipelineRun";

export const syncProjectCiStatus = (projectId: string) =>
  request<CiSyncResult>(`/api/v1/projects/${projectId}/ci-status/sync`, { method: "POST" });

export const getLatestProjectCiRun = (projectId: string) =>
  request<CiPipelineRun>(`/api/v1/projects/${projectId}/ci-status/latest`);

export const listProjectCiRuns = (projectId: string) =>
  request<CiPipelineRun[]>(`/api/v1/projects/${projectId}/ci-status/runs`);

export const getProjectCiMonitor = (projectId: string) =>
  request<CiStatusMonitorSchedule>(`/api/v1/projects/${projectId}/ci-monitor`);

export const updateProjectCiMonitor = (
  projectId: string,
  input: { enabled: boolean; cadence_minutes: CiMonitorCadence },
) => request<CiStatusMonitorSchedule>(`/api/v1/projects/${projectId}/ci-monitor`, {
  method: "PUT",
  body: JSON.stringify(input),
});

export const pauseProjectCiMonitor = (projectId: string) =>
  request<CiStatusMonitorSchedule>(`/api/v1/projects/${projectId}/ci-monitor`, { method: "DELETE" });
