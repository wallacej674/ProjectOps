import { request } from "../../../api/client";
import type { ProjectReadinessOverview } from "../../../types/readiness";

export const listCrossProjectReadiness = () => request<ProjectReadinessOverview[]>("/api/v1/readiness");
