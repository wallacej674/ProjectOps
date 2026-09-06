import { request } from "../../../api/client";
import type { AlertPage, AlertDetail, HealthAlert } from "../../../types/healthAlert";
const base = (projectId: string) => `/api/v1/projects/${projectId}/health-alerts`;
export const listHealthAlerts = async (projectId: string, offset = 0) => {
  const page = await request<AlertPage>(`${base(projectId)}?limit=25&offset=${offset}`);
  if (!Array.isArray(page.items) || typeof page.total !== "number") throw new Error("Invalid alert response.");
  return page;
};
export const getHealthAlert = (projectId: string, id: number, offset = 0) => request<AlertDetail>(`${base(projectId)}/${id}?limit=25&offset=${offset}`);
export const acknowledgeHealthAlert = (projectId: string, id: number) => request<HealthAlert>(`${base(projectId)}/${id}/acknowledge`, { method: "POST" });
