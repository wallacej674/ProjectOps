import { request } from "../../../api/client";
import type { ProjectHealthSummary } from "../../../types/healthCheck";

export const listCrossProjectHealth = () => request<ProjectHealthSummary[]>("/api/v1/health-checks");
