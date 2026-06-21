import type { ProjectInput, ProjectStatus } from "../../types/project";

/** Statuses selectable on the create/edit form (archived is reached only via Archive). */
export const editableStatuses: Exclude<ProjectStatus, "archived">[] = [
  "planning",
  "development",
  "staging",
  "production",
  "paused",
];

export const blankInput: ProjectInput = {
  name: "",
  description: "",
  repo_url: "",
  production_url: "",
  status: "planning",
};

/** Trim text fields and coerce empty optional fields to null before submitting. */
export function normalizeInput(data: ProjectInput): ProjectInput {
  return {
    ...data,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    repo_url: data.repo_url?.trim() || null,
    production_url: data.production_url?.trim() || null,
  };
}
