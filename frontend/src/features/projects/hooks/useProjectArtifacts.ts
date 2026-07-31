import { useCallback, useEffect, useState } from "react";
import type {
  ProjectArtifact,
  ProjectArtifactCreate,
  ProjectArtifactSourceType,
  ProjectArtifactType,
  ProjectArtifactUpdate,
} from "../../../types/projectArtifact";
import {
  archiveProjectArtifact,
  createProjectArtifact,
  listProjectArtifacts,
  updateProjectArtifact,
} from "../api/projectArtifacts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProjectArtifact(value: unknown): value is ProjectArtifact {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.project_id === "number" &&
    typeof value.title === "string" &&
    typeof value.artifact_type === "string" &&
    typeof value.source_type === "string" &&
    typeof value.status === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

export function useProjectArtifacts(projectId: string) {
  const [artifacts, setArtifacts] = useState<ProjectArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [artifactTypeFilter, setArtifactTypeFilter] = useState<ProjectArtifactType | "">("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<ProjectArtifactSourceType | "">("");
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [mutationPending, setMutationPending] = useState(false);

  const loadArtifacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextArtifacts = await listProjectArtifacts(projectId, {
        includeArchived,
        artifactType: artifactTypeFilter,
        sourceType: sourceTypeFilter,
        search,
        tags: selectedTags,
      });
      setArtifacts(Array.isArray(nextArtifacts) ? nextArtifacts.filter(isProjectArtifact) : []);
    } catch (e) {
      setArtifacts([]);
      setError(e instanceof Error ? e.message : "Project artifacts could not load.");
    } finally {
      setLoading(false);
    }
  }, [artifactTypeFilter, includeArchived, projectId, search, selectedTags, sourceTypeFilter]);

  useEffect(() => {
    void loadArtifacts();
  }, [loadArtifacts]);

  async function createArtifact(input: ProjectArtifactCreate) {
    setMutationPending(true);
    try {
      await createProjectArtifact(projectId, input);
      await loadArtifacts();
    } finally {
      setMutationPending(false);
    }
  }

  async function updateArtifact(artifactId: number, input: ProjectArtifactUpdate) {
    setMutationPending(true);
    try {
      await updateProjectArtifact(projectId, String(artifactId), input);
      await loadArtifacts();
    } finally {
      setMutationPending(false);
    }
  }

  async function archiveArtifact(artifactId: number) {
    setMutationPending(true);
    try {
      await archiveProjectArtifact(projectId, String(artifactId));
      await loadArtifacts();
    } finally {
      setMutationPending(false);
    }
  }

  function toggleTagFilter(tag: string) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) return;
    setSelectedTags((currentTags) =>
      currentTags.includes(normalized)
        ? currentTags.filter((currentTag) => currentTag !== normalized)
        : [...currentTags, normalized],
    );
  }

  function clearFilters() {
    setSearch("");
    setSelectedTags([]);
    setArtifactTypeFilter("");
    setSourceTypeFilter("");
  }

  return {
    artifacts,
    loading,
    error,
    includeArchived,
    artifactTypeFilter,
    sourceTypeFilter,
    search,
    selectedTags,
    mutationPending,
    setIncludeArchived,
    setArtifactTypeFilter,
    setSourceTypeFilter,
    setSearch,
    toggleTagFilter,
    clearFilters,
    createArtifact,
    updateArtifact,
    archiveArtifact,
  };
}
