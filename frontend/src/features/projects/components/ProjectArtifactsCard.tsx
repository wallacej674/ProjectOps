import { useState } from "react";
import type {
  ProjectArtifact,
  ProjectArtifactCreate,
  ProjectArtifactSourceType,
  ProjectArtifactType,
} from "../../../types/projectArtifact";
import type { ProjectReadinessEvidenceCoverage } from "../../../types/readiness";
import { formatDate } from "../../../utils/formatDate";
import { ProjectArtifactArchiveModal } from "./ProjectArtifactArchiveModal";
import { ProjectArtifactForm } from "./ProjectArtifactForm";

const artifactTypeLabels: Record<ProjectArtifactType, string> = {
  note: "Note",
  document: "Document",
  link: "Link",
  runbook: "Runbook",
  decision: "Decision",
  incident: "Incident",
  requirement: "Requirement",
  risk: "Risk",
  evidence: "Evidence",
  other: "Other",
};

const sourceTypeLabels: Record<ProjectArtifactSourceType, string> = {
  manual: "Manual",
  external_url: "External URL",
  imported: "Imported",
  system: "System",
};

function previewText(artifact: ProjectArtifact) {
  return artifact.summary || artifact.content || "No summary or note content has been added.";
}

function tagList(tags: string | null) {
  return (tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizedTag(tag: string) {
  return tag.trim().toLowerCase();
}

type EvidenceUsageFilter = "all" | "linked" | "unlinked";

interface ArtifactEvidenceUsage {
  linkedItemCount: number;
  itemLabels: string[];
}

function buildArtifactUsageMap(coverage: ProjectReadinessEvidenceCoverage | null) {
  const usage = new Map<number, ArtifactEvidenceUsage>();
  for (const row of coverage?.artifact_usage ?? []) {
    usage.set(row.artifact.id, {
      linkedItemCount: row.linked_item_count,
      itemLabels: row.readiness_items.map((item) => item.label),
    });
  }
  for (const item of coverage?.readiness_items ?? []) {
    for (const artifact of item.artifacts) {
      const current = usage.get(artifact.id) ?? { linkedItemCount: 0, itemLabels: [] };
      if (!current.itemLabels.includes(item.label)) {
        current.itemLabels.push(item.label);
      }
      usage.set(artifact.id, {
        linkedItemCount: current.itemLabels.length,
        itemLabels: current.itemLabels,
      });
    }
  }
  return usage;
}

function usageLabel(artifact: ProjectArtifact, usageByArtifactId: Map<number, ArtifactEvidenceUsage>) {
  const usage = usageByArtifactId.get(artifact.id);
  if (!usage || usage.linkedItemCount === 0) return "Not currently linked to readiness evidence.";
  const itemText = usage.linkedItemCount === 1 ? "readiness item" : "readiness items";
  return `Supports ${usage.linkedItemCount} ${itemText}: ${usage.itemLabels.join(", ")}`;
}

function ProjectArtifactList({
  artifacts,
  editingArtifact,
  pending,
  submitError,
  selectedTags,
  usageByArtifactId,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  onStartArchive,
  onToggleTag,
}: {
  artifacts: ProjectArtifact[];
  editingArtifact: ProjectArtifact | null;
  pending: boolean;
  submitError: string;
  selectedTags: string[];
  usageByArtifactId: Map<number, ArtifactEvidenceUsage>;
  onEdit: (artifact: ProjectArtifact) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (artifact: ProjectArtifact, input: ProjectArtifactCreate) => Promise<void>;
  onStartArchive: (artifact: ProjectArtifact) => void;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <ul className="artifact-list" aria-label="Project artifacts">
      {artifacts.map((artifact) => {
        const tags = tagList(artifact.tags);
        const isEditing = editingArtifact?.id === artifact.id;
        return (
          <li className={`artifact-item ${artifact.status}`} key={artifact.id}>
            {isEditing ? (
              <ProjectArtifactForm
                artifact={artifact}
                pending={pending}
                submitError={submitError}
                onSubmit={(input) => onSubmitEdit(artifact, input)}
                onCancel={onCancelEdit}
              />
            ) : (
              <>
                <div className="row artifact-item-head">
                  <div>
                    <h3>{artifact.title}</h3>
                    <div className="artifact-badges">
                      <span className="badge">{artifactTypeLabels[artifact.artifact_type]}</span>
                      <span className="badge">{sourceTypeLabels[artifact.source_type]}</span>
                      <span className={`badge ${artifact.status}`}>{artifact.status === "archived" ? "Archived" : "Active"}</span>
                    </div>
                  </div>
                  <div className="artifact-actions">
                    <button
                      className="button"
                      type="button"
                      aria-label={`Edit ${artifact.title}`}
                      onClick={() => onEdit(artifact)}
                    >
                      Edit
                    </button>
                    {artifact.status !== "archived" && (
                      <button
                        className="button danger"
                        type="button"
                        aria-label={`Archive ${artifact.title}`}
                        onClick={() => onStartArchive(artifact)}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
                <p>{previewText(artifact)}</p>
                {artifact.url && (
                  <a className="link mono artifact-url" href={artifact.url} target="_blank" rel="noreferrer">
                    Open artifact URL
                  </a>
                )}
                {tags.length > 0 && (
                  <ul className="chip-list" aria-label={`Tags for ${artifact.title}`}>
                    {tags.map((tag) => (
                      <li key={tag}>
                        <button
                          className={selectedTags.includes(normalizedTag(tag)) ? "chip-button active" : "chip-button"}
                          type="button"
                          aria-label={`Filter by tag ${tag}`}
                          aria-pressed={selectedTags.includes(normalizedTag(tag))}
                          onClick={() => onToggleTag(tag)}
                        >
                          {tag}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="meta">{usageLabel(artifact, usageByArtifactId)}</p>
                <div className="meta history-meta">
                  <span>Updated {formatDate(artifact.updated_at)}</span>
                  <span>Artifact ID {artifact.id}</span>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectArtifactsCard({
  artifacts,
  loading,
  error,
  includeArchived,
  artifactTypeFilter,
  sourceTypeFilter,
  search,
  selectedTags,
  evidenceCoverage,
  pending,
  onIncludeArchivedChange,
  onArtifactTypeFilterChange,
  onSourceTypeFilterChange,
  onSearchChange,
  onToggleTag,
  onClearFilters,
  onCreate,
  onUpdate,
  onArchive,
}: {
  artifacts: ProjectArtifact[];
  loading: boolean;
  error: string;
  includeArchived: boolean;
  artifactTypeFilter: ProjectArtifactType | "";
  sourceTypeFilter: ProjectArtifactSourceType | "";
  search: string;
  selectedTags: string[];
  evidenceCoverage: ProjectReadinessEvidenceCoverage | null;
  pending: boolean;
  onIncludeArchivedChange: (includeArchived: boolean) => void;
  onArtifactTypeFilterChange: (artifactType: ProjectArtifactType | "") => void;
  onSourceTypeFilterChange: (sourceType: ProjectArtifactSourceType | "") => void;
  onSearchChange: (search: string) => void;
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  onCreate: (input: ProjectArtifactCreate) => Promise<void>;
  onUpdate: (artifactId: number, input: ProjectArtifactCreate) => Promise<void>;
  onArchive: (artifactId: number) => Promise<void>;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState<ProjectArtifact | null>(null);
  const [archiveArtifact, setArchiveArtifact] = useState<ProjectArtifact | null>(null);
  const [evidenceUsageFilter, setEvidenceUsageFilter] = useState<EvidenceUsageFilter>("all");
  const [submitError, setSubmitError] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const usageByArtifactId = buildArtifactUsageMap(evidenceCoverage);
  const visibleArtifacts = artifacts.filter((artifact) => {
    const linkedItemCount = usageByArtifactId.get(artifact.id)?.linkedItemCount ?? 0;
    if (evidenceUsageFilter === "linked") return linkedItemCount > 0;
    if (evidenceUsageFilter === "unlinked") return linkedItemCount === 0;
    return true;
  });
  const hasArtifacts = visibleArtifacts.length > 0;
  const hasActiveFilters = Boolean(
    search.trim() || artifactTypeFilter || sourceTypeFilter || selectedTags.length > 0 || evidenceUsageFilter !== "all",
  );
  const resultLabel = `${visibleArtifacts.length} artifact${visibleArtifacts.length === 1 ? "" : "s"} shown`;

  async function createArtifact(input: ProjectArtifactCreate) {
    setSubmitError("");
    try {
      await onCreate(input);
      setShowCreateForm(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Artifact could not be created.");
    }
  }

  async function updateArtifact(artifact: ProjectArtifact, input: ProjectArtifactCreate) {
    setSubmitError("");
    try {
      await onUpdate(artifact.id, input);
      setEditingArtifact(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Artifact could not be saved.");
    }
  }

  async function confirmArchive() {
    if (!archiveArtifact) return;
    setArchiveError("");
    try {
      await onArchive(archiveArtifact.id);
      setArchiveArtifact(null);
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "Artifact could not be archived.");
    }
  }

  return (
    <section className="panel detail-panel artifacts-panel" aria-labelledby="project-artifacts-title">
      <div className="row artifact-heading">
        <div>
          <div className="eyebrow">DataForge Lite</div>
          <h2 id="project-artifacts-title">Project Artifacts</h2>
          <p className="artifacts-intro">
            Register notes, links, runbooks, decisions, and evidence records for this Project. This stores metadata and
            references only; ProjectOps is not analyzing document contents yet.
          </p>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setSubmitError("");
            setEditingArtifact(null);
            setShowCreateForm(true);
          }}
        >
          Add Artifact
        </button>
      </div>

      <div className="artifact-controls">
        <div className="field artifact-search-field">
          <label htmlFor="artifact-search">Search artifacts</label>
          <input
            id="artifact-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-describedby="artifact-search-hint"
          />
          <div className="hint" id="artifact-search-hint">
            Search scans artifact metadata and text fields, not uploaded document contents.
          </div>
        </div>
        <div className="field">
          <label htmlFor="artifact-type-filter">Filter artifacts by type</label>
          <select
            id="artifact-type-filter"
            value={artifactTypeFilter}
            onChange={(event) => onArtifactTypeFilterChange(event.target.value as ProjectArtifactType | "")}
          >
            <option value="">All types</option>
            {Object.entries(artifactTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="artifact-source-filter">Filter artifacts by source</label>
          <select
            id="artifact-source-filter"
            value={sourceTypeFilter}
            onChange={(event) => onSourceTypeFilterChange(event.target.value as ProjectArtifactSourceType | "")}
          >
            <option value="">All sources</option>
            {Object.entries(sourceTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="artifact-evidence-usage-filter">Filter artifacts by readiness evidence usage</label>
          <select
            id="artifact-evidence-usage-filter"
            value={evidenceUsageFilter}
            onChange={(event) => setEvidenceUsageFilter(event.target.value as EvidenceUsageFilter)}
          >
            <option value="all">All usage</option>
            <option value="linked">Linked to readiness</option>
            <option value="unlinked">Not linked to readiness</option>
          </select>
        </div>
        <label className="check-row artifact-include-archived">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => onIncludeArchivedChange(event.target.checked)}
          />
          Include archived artifacts
        </label>
      </div>
      <div className="artifact-filter-status">
        <p className="meta" aria-live="polite">
          {resultLabel}
        </p>
        {hasActiveFilters && <span className="badge">Filters active</span>}
        {selectedTags.length > 0 && (
          <ul className="chip-list selected-tags" aria-label="Selected artifact tag filters">
            {selectedTags.map((tag) => (
              <li key={tag}>
                <button
                  className="chip-button active"
                  type="button"
                  aria-label={`Remove tag filter ${tag}`}
                  onClick={() => onToggleTag(tag)}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
        {hasActiveFilters && (
          <button
            className="button"
            type="button"
            onClick={() => {
              setEvidenceUsageFilter("all");
              onClearFilters();
            }}
          >
            Clear artifact filters
          </button>
        )}
      </div>

      {showCreateForm && (
        <section className="artifact-section" aria-labelledby="artifact-create-form-title">
          <h3 id="artifact-create-form-title">New Artifact</h3>
          <ProjectArtifactForm
            pending={pending}
            submitError={submitError}
            onSubmit={createArtifact}
            onCancel={() => {
              setSubmitError("");
              setShowCreateForm(false);
            }}
          />
        </section>
      )}

      {loading ? (
        <p className="meta" aria-live="polite">
          Loading artifacts...
        </p>
      ) : error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : hasArtifacts ? (
        <ProjectArtifactList
          artifacts={visibleArtifacts}
          editingArtifact={editingArtifact}
          pending={pending}
          submitError={submitError}
          selectedTags={selectedTags}
          usageByArtifactId={usageByArtifactId}
          onEdit={(artifact) => {
            setSubmitError("");
            setShowCreateForm(false);
            setEditingArtifact(artifact);
          }}
          onCancelEdit={() => {
            setSubmitError("");
            setEditingArtifact(null);
          }}
          onSubmitEdit={updateArtifact}
          onStartArchive={(artifact) => {
            setArchiveError("");
            setArchiveArtifact(artifact);
          }}
          onToggleTag={onToggleTag}
        />
      ) : (
        <div className="artifact-empty">
          <h3>{hasActiveFilters ? "No artifacts match these filters." : "No artifacts yet."}</h3>
          <p>
            {hasActiveFilters
              ? "Try clearing filters or searching for different artifact metadata."
              : "Add notes, links, runbooks, or evidence records that help explain this Project."}
          </p>
        </div>
      )}

      {archiveArtifact && (
        <ProjectArtifactArchiveModal
          artifact={archiveArtifact}
          pending={pending}
          error={archiveError}
          onClose={() => setArchiveArtifact(null)}
          onConfirm={confirmArchive}
        />
      )}
    </section>
  );
}
