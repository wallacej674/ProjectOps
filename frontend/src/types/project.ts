export const projectStatuses = ["planning", "development", "staging", "production", "paused", "archived"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export interface Project {
  id: number;
  name: string;
  description: string | null;
  repo_url: string | null;
  production_url: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  repo_url?: string | null;
  production_url?: string | null;
  status: Exclude<ProjectStatus, "archived">;
}
