import { request } from "./client";
import type { Project } from "../types/project";

export interface DemoDataStatus {
  enabled: boolean;
  reason: string | null;
}

export interface DemoDataSeedResult {
  created: boolean;
  project: Project;
  message: string;
}

export const demoDataApi = {
  status: () => request<DemoDataStatus>("/api/v1/demo-data/status"),
  seed: () => request<DemoDataSeedResult>("/api/v1/demo-data/seed", { method: "POST" }),
};
