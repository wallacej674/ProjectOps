import { useEffect, useRef, useState } from "react";
import type { ProjectArtifact, ProjectArtifactSourceType, ProjectArtifactType } from "../../../types/projectArtifact";
import {
  readinessStatuses,
  type ProjectReadinessEvidenceCoverage,
  type ProjectReadinessItem,
  type ProjectReadinessSummary,
  type ReadinessStatus,
} from "../../../types/readiness";

const evidenceSources = [
  "Project metadata",
  "Repository connection",
  "CodeMap Lite analysis",
  "Manual health check",
  "Manual review items",
];

const statusLabels: Record<string, string> = {
  not_started: "Not started",
  needs_work: "Needs work",
  in_progress: "In progress",
  strong: "Strong evidence",
};

const itemStatusLabels: Record<ReadinessStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  unknown: "Unknown",
  not_applicable: "Not applicable",
};

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

const sourceDescriptions: Record<string, string> = {
  codemap: "ProjectOps evaluated this item from the latest CodeMap Lite analysis.",
  health_check: "ProjectOps evaluated this item from the latest manual health check.",
  project: "ProjectOps evaluated this item from Project metadata.",
  manual: "This item requires manual review.",
};

function displayStatus(status?: string) {
  if (!status) return "Not started";
  return statusLabels[status] || status.replaceAll("_", " ");
}

function ReadinessScoreSummary({ readiness }: { readiness: ProjectReadinessSummary }) {
  const scoreLabel = readiness.score === null ? "No score yet" : `${readiness.score}`;
  const progressValue = readiness.score ?? 0;

  return (
    <section className="readiness-section" aria-labelledby="readiness-score-title">
      <div className="readiness-score-grid">
        <div>
          <h3 id="readiness-score-title">Advisory Score</h3>
          <div className="readiness-score" aria-label={`Advisory readiness score: ${scoreLabel} out of 100`}>
            {scoreLabel}
          </div>
          <div className="readiness-progress" aria-hidden="true">
            <span style={{ width: `${progressValue}%` }} />
          </div>
        </div>
        <div>
          <div className="badge readiness-status">{displayStatus(readiness.status)}</div>
          <ul className="readiness-counts" aria-label="Readiness item counts">
            <li>{readiness.passed} passed</li>
            <li>{readiness.failed} failed</li>
            <li>{readiness.unknown} unknown</li>
            <li>{readiness.not_applicable} not applicable</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function ReadinessTopGaps({ gaps }: { gaps?: string[] }) {
  const visibleGaps = Array.isArray(gaps) ? gaps : [];
  return (
    <section className="readiness-section" aria-labelledby="readiness-top-gaps-title">
      <h3 id="readiness-top-gaps-title">Top Gaps</h3>
      {visibleGaps.length > 0 ? (
        <ul className="readiness-gap-list">
          {visibleGaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : (
        <p className="meta">No top gaps were returned.</p>
      )}
    </section>
  );
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function ReadinessEvidenceCoverageSummary({
  coverage,
  loading,
}: {
  coverage: ProjectReadinessEvidenceCoverage | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="readiness-section" aria-labelledby="readiness-evidence-coverage-title">
        <h3 id="readiness-evidence-coverage-title">Evidence Coverage</h3>
        <p className="meta" aria-live="polite">
          Loading evidence coverage...
        </p>
      </section>
    );
  }

  if (!coverage) return null;

  return (
    <section className="readiness-section" aria-labelledby="readiness-evidence-coverage-title">
      <h3 id="readiness-evidence-coverage-title">Evidence Coverage</h3>
      <ul className="readiness-counts" aria-label="Readiness evidence coverage counts">
        <li>{plural(coverage.linked_active_artifacts, "linked active artifact")}</li>
        <li>{plural(coverage.unlinked_active_artifacts, "unlinked active artifact")}</li>
        <li>{plural(coverage.readiness_items_with_linked_artifacts, "readiness item")} with supporting artifacts</li>
        <li>{plural(coverage.readiness_items_without_linked_artifacts, "readiness item")} without supporting artifacts</li>
      </ul>
      <p className="meta">
        Linked artifacts are supporting references supplied by your team. ProjectOps does not verify artifact contents in
        DataForge Lite.
      </p>
    </section>
  );
}

function evidenceText(item: ProjectReadinessItem) {
  const evidence = item.evidence;
  if (!evidence) return "No evidence available yet.";
  if ("signal" in evidence) {
    const signal = String(evidence.signal);
    const analysisId = String(evidence.analysis_id);
    return `Signal ${signal} was ${evidence.value ? "detected" : "not detected"} in analysis ${analysisId}.`;
  }
  if ("health_check_id" in evidence) {
    return `Latest health check ${String(evidence.health_check_id)} returned ${String(evidence.status)}.`;
  }
  if ("field" in evidence) {
    return `Project field ${String(evidence.field)} is ${evidence.present ? "present" : "missing"}.`;
  }
  return "Structured evidence is available for this item.";
}

function missingEvidenceHelp(item: ProjectReadinessItem) {
  if (item.evidence || item.source === "manual") return null;
  return "Run CodeMap Lite or a manual health check to improve the evidence available to readiness.";
}

function ManualReadinessItemEditor({
  item,
  onSave,
}: {
  item: ProjectReadinessItem;
  onSave: (itemKey: string, status: ReadinessStatus, notes: string | null) => Promise<void>;
}) {
  const [status, setStatus] = useState<ReadinessStatus>(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const statusId = `readiness-${item.item.key}-status`;
  const notesId = `readiness-${item.item.key}-notes`;
  const errorId = `readiness-${item.item.key}-error`;

  useEffect(() => {
    setStatus(item.status);
    setNotes(item.notes ?? "");
  }, [item]);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await onSave(item.item.key, status, notes.trim() || null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Manual review item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="manual-readiness-editor">
      <p className="meta">Manual review items are completed by an engineer. ProjectOps does not infer them automatically.</p>
      <div className="field">
        <label htmlFor={statusId}>Status for {item.item.label}</label>
        <select
          id={statusId}
          value={status}
          onChange={(event) => setStatus(event.target.value as ReadinessStatus)}
          disabled={saving}
        >
          {readinessStatuses.map((value) => (
            <option value={value} key={value}>
              {itemStatusLabels[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={notesId}>Notes for {item.item.label}</label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          disabled={saving}
        />
      </div>
      {error && (
        <p className="error-text" id={errorId} role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="meta" aria-live="polite">
          Manual review saved.
        </p>
      )}
      <button className="button" type="button" disabled={saving} onClick={save}>
        {saving ? "Saving" : `Save ${item.item.label}`}
      </button>
    </div>
  );
}

function SupportingArtifactControl({
  item,
  artifacts,
  evidence,
  evidenceLoading,
  onLinkArtifactEvidence,
  onUnlinkArtifactEvidence,
}: {
  item: ProjectReadinessItem;
  artifacts: ProjectArtifact[];
  evidence: ProjectArtifact[];
  evidenceLoading: boolean;
  onLinkArtifactEvidence: (itemKey: string, artifactId: number) => Promise<void>;
  onUnlinkArtifactEvidence: (itemKey: string, artifactId: number) => Promise<void>;
}) {
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const activeArtifacts = artifacts.filter((artifact) => artifact.status === "active");
  const linkedArtifactIds = new Set(evidence.map((artifact) => artifact.id));
  const linkableArtifacts = activeArtifacts.filter((artifact) => !linkedArtifactIds.has(artifact.id));
  const selectId = `readiness-${item.item.key}-artifact-evidence`;
  const errorId = `readiness-${item.item.key}-artifact-evidence-error`;

  useEffect(() => {
    if (selectedArtifactId && !linkableArtifacts.some((artifact) => String(artifact.id) === selectedArtifactId)) {
      setSelectedArtifactId("");
    }
  }, [linkableArtifacts, selectedArtifactId]);

  async function linkSelectedArtifact() {
    if (!selectedArtifactId) return;
    setPending(true);
    setError("");
    try {
      await onLinkArtifactEvidence(item.item.key, Number(selectedArtifactId));
      setSelectedArtifactId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Artifact evidence could not be linked.");
    } finally {
      setPending(false);
    }
  }

  async function unlinkArtifact(artifactId: number) {
    setPending(true);
    setError("");
    try {
      await onUnlinkArtifactEvidence(item.item.key, artifactId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Artifact evidence could not be unlinked.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="readiness-artifact-evidence">
      {evidenceLoading ? (
        <p className="meta" aria-live="polite">
          Loading supporting artifacts...
        </p>
      ) : evidence.length > 0 ? (
        <ul className="readiness-artifact-list" aria-label={`Supporting artifacts for ${item.item.label}`}>
          {evidence.map((artifact) => (
            <li key={artifact.id}>
              <div>
                <strong>{artifact.title}</strong>
                <div className="artifact-badges">
                  <span className="badge">{artifactTypeLabels[artifact.artifact_type]}</span>
                  <span className="badge">{sourceTypeLabels[artifact.source_type]}</span>
                  <span className={`badge ${artifact.status}`}>
                    {artifact.status === "archived" ? "Archived" : "Active"}
                  </span>
                </div>
              </div>
              <button
                className="button"
                type="button"
                disabled={pending}
                onClick={() => unlinkArtifact(artifact.id)}
              >
                {`Unlink ${artifact.title} from ${item.item.label}`}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="meta">No supporting artifacts linked yet.</p>
      )}
      <div className="readiness-artifact-link-row">
        <div className="field">
          <label htmlFor={selectId}>Artifact evidence for {item.item.label}</label>
          <select
            id={selectId}
            value={selectedArtifactId}
            onChange={(event) => setSelectedArtifactId(event.target.value)}
            disabled={pending || linkableArtifacts.length === 0}
            aria-describedby={error ? errorId : undefined}
          >
            <option value="">Select an artifact</option>
            {linkableArtifacts.map((artifact) => (
              <option value={artifact.id} key={artifact.id}>
                {artifact.title}
              </option>
            ))}
          </select>
        </div>
        <button
          className="button"
          type="button"
          disabled={pending || !selectedArtifactId}
          onClick={linkSelectedArtifact}
        >
          {`Link artifact evidence for ${item.item.label}`}
        </button>
      </div>
      {error && (
        <p className="error-text" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ReadinessChecklist({
  items,
  artifacts,
  evidenceCoverage,
  evidenceLoading,
  onUpdateManualItem,
  onLinkArtifactEvidence,
  onUnlinkArtifactEvidence,
}: {
  items: ProjectReadinessItem[];
  artifacts: ProjectArtifact[];
  evidenceCoverage: ProjectReadinessEvidenceCoverage | null;
  evidenceLoading: boolean;
  onUpdateManualItem: (itemKey: string, status: ReadinessStatus, notes: string | null) => Promise<void>;
  onLinkArtifactEvidence: (itemKey: string, artifactId: number) => Promise<void>;
  onUnlinkArtifactEvidence: (itemKey: string, artifactId: number) => Promise<void>;
}) {
  const visibleItems = Array.isArray(items) ? items : [];
  const evidenceByItemKey = Object.fromEntries(
    (evidenceCoverage?.readiness_items ?? []).map((item) => [item.item_key, item.artifacts]),
  );
  return (
    <section className="readiness-section" aria-labelledby="readiness-checklist-title">
      <h3 id="readiness-checklist-title">Readiness Checklist</h3>
      <div className="readiness-supporting-artifacts-note">
        <h4>Supporting artifacts</h4>
        <p className="meta">
          Linked artifacts are references supplied by your team. ProjectOps does not verify their contents in DataForge Lite.
        </p>
      </div>
      {visibleItems.length === 0 ? (
        <p className="meta">No checklist items were returned.</p>
      ) : (
        <ul className="readiness-checklist">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <div className="row">
                <div>
                  <strong>{item.item.label}</strong>
                  <p>{item.item.description}</p>
                </div>
                <span className={`badge readiness-item-status ${item.status}`}>{itemStatusLabels[item.status]}</span>
              </div>
              <dl className="readiness-item-details">
                <div>
                  <dt>Source</dt>
                  <dd>{sourceDescriptions[item.source]}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{evidenceText(item)}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{item.item.category.replaceAll("_", " ")}</dd>
                </div>
              </dl>
              {missingEvidenceHelp(item) && <p className="meta">{missingEvidenceHelp(item)}</p>}
              {item.notes && <p className="readiness-notes">{item.notes}</p>}
              <SupportingArtifactControl
                item={item}
                artifacts={artifacts}
                evidence={evidenceByItemKey[item.item.key] ?? []}
                evidenceLoading={evidenceLoading}
                onLinkArtifactEvidence={onLinkArtifactEvidence}
                onUnlinkArtifactEvidence={onUnlinkArtifactEvidence}
              />
              {item.item.evaluation_type === "manual" && (
                <ManualReadinessItemEditor item={item} onSave={onUpdateManualItem} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReadinessAssessmentCard({
  readiness,
  loading,
  error,
  evaluating,
  artifacts,
  evidenceCoverage,
  evidenceLoading,
  onEvaluate,
  onUpdateManualItem,
  onLinkArtifactEvidence,
  onUnlinkArtifactEvidence,
}: {
  readiness: ProjectReadinessSummary | null;
  loading: boolean;
  error: string;
  evaluating: boolean;
  artifacts: ProjectArtifact[];
  evidenceCoverage: ProjectReadinessEvidenceCoverage | null;
  evidenceLoading: boolean;
  onEvaluate: () => void;
  onUpdateManualItem: (itemKey: string, status: ReadinessStatus, notes: string | null) => Promise<void>;
  onLinkArtifactEvidence: (itemKey: string, artifactId: number) => Promise<void>;
  onUnlinkArtifactEvidence: (itemKey: string, artifactId: number) => Promise<void>;
}) {
  const isNotStarted = !readiness || !readiness.status || readiness.status === "not_started";
  const runLabel = evaluating ? "Evaluating Readiness" : "Run Readiness Evaluation";
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const wasEvaluatingRef = useRef(false);

  useEffect(() => {
    if (wasEvaluatingRef.current && !evaluating) {
      runButtonRef.current?.focus();
    }
    wasEvaluatingRef.current = evaluating;
  }, [evaluating]);

  return (
    <section className="panel detail-panel readiness-panel" aria-labelledby="production-readiness-title">
      <div className="eyebrow">Advisory Assessment</div>
      <h2 id="production-readiness-title">Production Readiness</h2>
      <p className="readiness-intro">
        Readiness is an advisory assessment based on available ProjectOps evidence. This is not a deployment approval,
        security audit, or uptime guarantee.
      </p>
      {evaluating && (
        <p className="meta" aria-live="polite">
          Readiness evaluation is running...
        </p>
      )}
      {loading ? (
        <p className="meta" aria-live="polite">
          Loading readiness assessment...
        </p>
      ) : error ? (
        <div className="readiness-error">
          <p className="error-text" role="alert">
            {error}
          </p>
          <p>Project metadata and other evidence sections are still usable.</p>
        </div>
      ) : isNotStarted ? (
        <div className="readiness-empty">
          <h3>Evaluate readiness to see an advisory checklist based on available ProjectOps evidence.</h3>
          <p>
            ProjectOps uses project metadata, repository analysis, manual health-check results, and manual review items
            where available. Missing evidence may produce unknown or failed checklist items depending on backend rules.
          </p>
          <section className="readiness-section" aria-labelledby="readiness-evidence-sources-title">
            <h3 id="readiness-evidence-sources-title">Evidence Sources</h3>
            <ul className="readiness-source-list">
              {evidenceSources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="readiness-result">
          <ReadinessScoreSummary readiness={readiness} />
          <ReadinessTopGaps gaps={readiness.top_gaps} />
          <ReadinessEvidenceCoverageSummary coverage={evidenceCoverage} loading={evidenceLoading} />
          <ReadinessChecklist
            items={readiness.items}
            artifacts={artifacts}
            evidenceCoverage={evidenceCoverage}
            evidenceLoading={evidenceLoading}
            onUpdateManualItem={onUpdateManualItem}
            onLinkArtifactEvidence={onLinkArtifactEvidence}
            onUnlinkArtifactEvidence={onUnlinkArtifactEvidence}
          />
        </div>
      )}
      <button ref={runButtonRef} className="button primary" type="button" disabled={evaluating} onClick={onEvaluate}>
        {runLabel}
      </button>
    </section>
  );
}
