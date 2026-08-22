import { request } from "../../../api/client";
import type { ProjectLaunchChecklist, ProjectLaunchReport } from "../../../types/launchReport";

export const getProjectLaunchReport = (projectId: string) =>
  request<ProjectLaunchReport>(`/api/v1/projects/${projectId}/launch-report`);

export const getProjectLaunchChecklist = (projectId: string) =>
  request<ProjectLaunchChecklist>(`/api/v1/projects/${projectId}/launch-checklist`);
