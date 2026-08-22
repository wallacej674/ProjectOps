import type { ProjectArtifact } from "../../../types/projectArtifact";

export type LaunchDecisionValue = "go" | "no_go" | "defer";

export const launchDecisionLabels: Record<LaunchDecisionValue, string> = {
  go: "Go",
  no_go: "No-go",
  defer: "Defer",
};

export const launchDecisionTags: Record<LaunchDecisionValue, string> = {
  go: "go",
  no_go: "no-go",
  defer: "defer",
};

const tagToDecision: Record<string, LaunchDecisionValue> = {
  go: "go",
  "no-go": "no_go",
  no_go: "no_go",
  defer: "defer",
};

function normalizedTags(artifact: ProjectArtifact) {
  return (artifact.tags ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export function getLaunchDecisionValue(artifact: ProjectArtifact): LaunchDecisionValue | null {
  const tags = normalizedTags(artifact);
  const decisionTag = tags.find((tag) => tag in tagToDecision);
  return decisionTag ? tagToDecision[decisionTag] : null;
}

export function isLaunchDecisionArtifact(artifact: ProjectArtifact, includeArchived = false) {
  const tags = normalizedTags(artifact);
  return (
    artifact.artifact_type === "decision" &&
    (includeArchived || artifact.status === "active") &&
    tags.includes("launch-decision") &&
    tags.includes("go-no-go") &&
    getLaunchDecisionValue(artifact) !== null
  );
}

export function getLaunchDecisionHistory(
  artifacts: ProjectArtifact[],
  { includeArchived = false }: { includeArchived?: boolean } = {},
) {
  return artifacts
    .filter((artifact) => isLaunchDecisionArtifact(artifact, includeArchived))
    .sort((first, second) => {
      const createdAtOrder = second.created_at.localeCompare(first.created_at);
      return createdAtOrder === 0 ? second.id - first.id : createdAtOrder;
    });
}

export function getLaunchDecisionNotes(artifact: ProjectArtifact) {
  if (artifact.summary?.trim()) return artifact.summary.trim();
  const content = artifact.content?.trim();
  if (!content) return "";
  const notesMatch = content.match(/Notes:\s*([\s\S]*)$/i);
  return (notesMatch?.[1] ?? content).trim();
}
