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
  const latestDecisionRef = useRef<HTMLLIElement | null>(null);
  const history = decisionHistory ?? (latestDecision ? [latestDecision] : []);
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
      <h2 id="launch-decision-title">Launch Decision</h2>
      <p className="launch-report-intro">
        ProjectOps provides advisory signals; the final decision is human-recorded and stored as a Project Artifact.
      </p>

      <div className="launch-decision-layout">
        <div className="launch-decision-timeline-col">
          <h3 className="launch-decision-subhead" id="launch-decision-history-title">
            Decision history
          </h3>
          {loading ? (
            <p className="meta" aria-live="polite">
              Loading launch decision...
            </p>
          ) : error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : history.length > 0 ? (
            <ol className="decision-timeline" aria-labelledby="launch-decision-history-title">
              {history.map((artifact, index) => (
                <li
                  key={artifact.id}
                  className={index === 0 ? "current" : undefined}
                  ref={index === 0 ? latestDecisionRef : undefined}
                  tabIndex={index === 0 ? -1 : undefined}
                >
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
            <p className="meta">No launch decision has been recorded yet.</p>
          )}
        </div>

        <div className="launch-decision-form-col">
          <h3 className="launch-decision-subhead">Record a decision</h3>
          <form onSubmit={submit}>
            <div className="field">
              <span className="field-label" id="launch-decision-picker-label">
                Decision
              </span>
              <div className="decision-picker" role="radiogroup" aria-labelledby="launch-decision-picker-label">
                {Object.entries(launchDecisionLabels).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={decision === value}
                    className={`choice tone-${decisionTone[value as LaunchDecisionValue]}`}
                    disabled={pending}
                    onClick={() => setDecision(value as LaunchDecisionValue)}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
        </div>
      </div>
    </section>
  );
}
