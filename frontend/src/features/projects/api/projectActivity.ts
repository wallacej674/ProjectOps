import { request } from "../../../api/client";
import type { CrossProjectActivityEvent, ProjectActivityEvent, ProjectActivityFilters } from "../../../types/projectActivity";

function activityParams(filters: ProjectActivityFilters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.eventType) params.set("event_type", filters.eventType);
  if (filters.projectId !== undefined) params.set("project_id", String(filters.projectId));
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  return params;
}

function projectActivityListPath(projectId: string, filters: ProjectActivityFilters = {}) {
  const params = activityParams(filters);
  params.delete("project_id");
  const query = params.toString();
  return `/api/v1/projects/${projectId}/activity${query ? `?${query}` : ""}`;
}

function activityListPath(filters: ProjectActivityFilters = {}) {
  const query = activityParams(filters).toString();
  return `/api/v1/activity${query ? `?${query}` : ""}`;
}

export const listProjectActivity = (projectId: string, filters: ProjectActivityFilters = {}) =>
  request<ProjectActivityEvent[]>(projectActivityListPath(projectId, filters));

export const listActivity = (filters: ProjectActivityFilters = {}) =>
  request<CrossProjectActivityEvent[]>(activityListPath(filters));
