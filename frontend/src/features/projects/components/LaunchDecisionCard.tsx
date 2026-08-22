import { useRef, useState, type FormEvent } from "react";
import { formatDate } from "../../../utils/formatDate";
import type { ProjectArtifact } from "../../../types/projectArtifact";
import {
  getLaunchDecisionNotes,
  getLaunchDecisionValue,
  launchDecisionLabels,
  type LaunchDecisionValue,
} from "../utils/launchDecisionArtifacts";

export type { LaunchDecisionValue };

const decisionTone: Record<LaunchDecisionValue, string> = {
  go: "success",
  no_go: "danger",
  defer: "warning",
};
const maxDecisionNotesLength = 2000;

function decisionLabel(artifact: ProjectArtifact) {
  const decision = getLaunchDecisionValue(artifact);
  return decision ? launchDecisionLabels[decision] : artifact.title;
}

function recorderText(artifact: ProjectArtifact) {
  const displayName = artifact.created_by_user?.display_name?.trim();
  if (displayName) return `Recorded by ${displayName}`;
  const email = artifact.created_by_user?.email?.trim();
  if (email) return `Recorded by ${email}`;
  return "Recorder unavailable for this historical record.";
}

export function LaunchDecisionCard({
  decisionHistory,
  latestDecision,
  loading,
  error,
  pending,
  onRecord,
}: {
  decisionHistory?: ProjectArtifact[];
  latestDecision?: ProjectArtifact | null;
  loading: boolean;
  error: string;
  pending: boolean;
  onRecord: (decision: LaunchDecisionValue, notes: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState<LaunchDecisionValue>("defer");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState("");
  const latestDecisionRef = useRef<HTMLDivElement | null>(null);
  const history = decisionHistory ?? (latestDecision ? [latestDecision] : []);
  const currentDecision = history[0] ?? null;
  const notesDescription = submitError
    ? "launch-decision-notes-help launch-decision-submit-error"
    : "launch-decision-notes-help";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    const trimmedNotes = notes.trim();
    if (decision !== "go" && !trimmedNotes) {
      setSubmitError(`${launchDecisionLabels[decision]} decisions require notes.`);
      return;
    }
    if (trimmedNotes.length > maxDecisionNotesLength) {
      setSubmitError("Decision notes must be 2,000 characters or fewer.");
      return;
    }
    try {
      await onRecord(decision, notes);
      setNotes("");
      window.setTimeout(() => latestDecisionRef.current?.focus(), 0);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Launch decision could not be recorded.");
    }
  }

  return (
    <section className="panel detail-panel launch-decision-panel" aria-labelledby="launch-decision-title">
      <div className="eyebrow">Human launch decision</div>
      <div className="row launch-report-heading">
        <div>
          <h2 id="launch-decision-title">Launch Decision</h2>
          <p className="launch-report-intro">
            ProjectOps provides advisory signals; the final decision is human-recorded and stored as a Project Artifact.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="meta" aria-live="polite">
          Loading launch decision...
        </p>
      ) : error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : currentDecision ? (
        <div className="launch-decision-current" ref={latestDecisionRef} tabIndex={-1}>
          <span className="badge">Latest decision</span>
          <strong>
            <span className={`badge ${decisionTone[getLaunchDecisionValue(currentDecision) ?? "defer"]}`}>
              {decisionLabel(currentDecision)}
            </span>
            {currentDecision.title}
          </strong>
          <p>{getLaunchDecisionNotes(currentDecision) || "No decision notes have been recorded."}</p>
          <div className="meta history-meta">
            <time dateTime={currentDecision.created_at}>Recorded {formatDate(currentDecision.created_at)}</time>
            <span>Artifact status {currentDecision.status}</span>
            <span>Artifact ID {currentDecision.id}</span>
          </div>
          <p className="meta">{recorderText(currentDecision)}</p>
        </div>
      ) : (
        <p className="meta">No launch decision has been recorded yet.</p>
      )}

      <section className="launch-decision-history" aria-labelledby="launch-decision-history-title">
        <h3 id="launch-decision-history-title">Decision history</h3>
        {history.length > 0 ? (
          <ol className="history-list">
            {history.map((artifact) => (
              <li key={artifact.id}>
                <div className="row launch-decision-history-row">
                  <strong>
                    <span className={`badge ${decisionTone[getLaunchDecisionValue(artifact) ?? "defer"]}`}>
                      {decisionLabel(artifact)}
                    </span>
                    {artifact.title}
                  </strong>
                  <a className="link" href="#artifacts">
                    View in Project Artifacts
                  </a>
                </div>
                <p>{getLaunchDecisionNotes(artifact) || "No decision notes have been recorded."}</p>
                <div className="meta history-meta">
                  <time dateTime={artifact.created_at}>Recorded {formatDate(artifact.created_at)}</time>
                  <span>{recorderText(artifact)}</span>
                  <span>Status {artifact.status}</span>
                  <span>Artifact ID {artifact.id}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="meta">Decision history is empty.</p>
        )}
      </section>

      <form className="launch-decision-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="launch-decision-select">Decision</label>
          <select
            id="launch-decision-select"
            value={decision}
            onChange={(event) => setDecision(event.target.value as LaunchDecisionValue)}
            disabled={pending}
          >
            {Object.entries(launchDecisionLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="launch-decision-notes">Decision notes</label>
          <textarea
            id="launch-decision-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={pending}
            maxLength={maxDecisionNotesLength}
            aria-describedby={notesDescription}
            aria-invalid={Boolean(submitError)}
          />
          <span className="hint" id="launch-decision-notes-help">
            No-go and Defer require notes. Go notes are optional but recommended. Do not paste secrets.
          </span>
        </div>
        {submitError && (
          <p className="error-text" id="launch-decision-submit-error" role="alert">
            {submitError}
          </p>
        )}
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Recording launch decision" : "Record Launch Decision"}
        </button>
      </form>
    </section>
  );
}
