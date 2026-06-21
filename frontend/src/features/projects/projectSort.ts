import type { Project, ProjectStatus } from "../../types/project";

export const sortOptions = [
  { value: "updated-desc", label: "Recently updated" },
  { value: "updated-asc", label: "Oldest updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "status", label: "Status" },
] as const;

export type SortKey = (typeof sortOptions)[number]["value"];

export const defaultSort: SortKey = "updated-desc";

/** Canonical lifecycle ordering used by the "Status" sort. */
const statusOrder: Record<ProjectStatus, number> = {
  planning: 0,
  development: 1,
  staging: 2,
  production: 3,
  paused: 4,
  archived: 5,
};

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
const byId = (a: Project, b: Project) => a.id - b.id;
const byUpdated = (a: Project, b: Project) => (a.updated_at < b.updated_at ? -1 : a.updated_at > b.updated_at ? 1 : 0);

/** Deterministic secondary ordering: name A–Z, then id ascending. */
const tieBreak = (a: Project, b: Project) => byName(a, b) || byId(a, b);

/** Return a new array sorted by `key`, never mutating the input. */
export function sortProjects(projects: Project[], key: SortKey): Project[] {
  const sorted = [...projects];
  sorted.sort((a, b) => {
    switch (key) {
      case "updated-asc":
        return byUpdated(a, b) || tieBreak(a, b);
      case "name-asc":
        return byName(a, b) || byId(a, b);
      case "name-desc":
        return -byName(a, b) || byId(a, b);
      case "status":
        return statusOrder[a.status] - statusOrder[b.status] || tieBreak(a, b);
      case "updated-desc":
      default:
        return -byUpdated(a, b) || tieBreak(a, b);
    }
  });
  return sorted;
}
