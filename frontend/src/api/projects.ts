import { request } from "./client";
import type { Project, ProjectInput } from "../types/project";

export const projectsApi = {
  list: (includeArchived = false) => request<Project[]>(`/api/v1/projects?include_archived=${includeArchived}`),
  get: (id: string) => request<Project>(`/api/v1/projects/${id}`),
  create: (input: ProjectInput) => request<Project>("/api/v1/projects", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Partial<ProjectInput>) => request<Project>(`/api/v1/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archive: (id: string) => request<Project>(`/api/v1/projects/${id}`, { method: "DELETE" }),
};
