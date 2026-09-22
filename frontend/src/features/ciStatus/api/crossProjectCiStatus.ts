import { request } from "../../../api/client";
import type { ProjectCiStatusSummary } from "../../../types/ciPipelineRun";

export const listCrossProjectCiStatus = () => request<ProjectCiStatusSummary[]>("/api/v1/ci-status");
