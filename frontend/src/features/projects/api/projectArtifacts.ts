import { request } from "../../../api/client";
import type {
  ProjectArtifact,
  ProjectArtifactCreate,
  ProjectArtifactListOptions,
  ProjectArtifactUpdate,
} from "../../../types/projectArtifact";

function artifactListPath(projectId: string, options: ProjectArtifactListOptions = {}) {
  const params = new URLSearchParams();
  if (options.includeArchived) params.set("include_archived", "true");
  if (options.artifactType) params.set("artifact_type", options.artifactType);
  if (options.sourceType) params.set("source_type", options.sourceType);
  if (options.search?.trim()) params.set("search", options.search.trim());
  const tags = options.tags?.map((tag) => tag.trim()).filter(Boolean);
  if (tags?.length) params.set("tags", tags.join(","));
  const query = params.toString();
  return `/api/v1/projects/${projectId}/artifacts${query ? `?${query}` : ""}`;
}

export const createProjectArtifact = (projectId: string, input: ProjectArtifactCreate) =>
  request<ProjectArtifact>(`/api/v1/projects/${projectId}/artifacts`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const listProjectArtifacts = (projectId: string, options: ProjectArtifactListOptions = {}) =>
  request<ProjectArtifact[]>(artifactListPath(projectId, options));

export const getProjectArtifact = (projectId: string, artifactId: string) =>
  request<ProjectArtifact>(`/api/v1/projects/${projectId}/artifacts/${artifactId}`);

export const updateProjectArtifact = (projectId: string, artifactId: string, input: ProjectArtifactUpdate) =>
  request<ProjectArtifact>(`/api/v1/projects/${projectId}/artifacts/${artifactId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const archiveProjectArtifact = (projectId: string, artifactId: string) =>
  request<ProjectArtifact>(`/api/v1/projects/${projectId}/artifacts/${artifactId}`, { method: "DELETE" });
