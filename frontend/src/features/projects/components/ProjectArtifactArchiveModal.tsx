import { useFocusTrap } from "../../../hooks/useFocusTrap";
import type { ProjectArtifact } from "../../../types/projectArtifact";

export function ProjectArtifactArchiveModal({
  artifact,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  artifact: ProjectArtifact;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useFocusTrap<HTMLElement>(true, onClose);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-archive-title"
        ref={dialogRef}
      >
        <div className="eyebrow">Project Artifacts</div>
        <h2 id="artifact-archive-title">Archive {artifact.title}?</h2>
        <p>
          This removes the artifact from the default active view. It does not delete the Project or any external
          document the artifact links to.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button" type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button className="button danger" type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Archiving" : "Archive Artifact"}
          </button>
        </div>
      </section>
    </div>
  );
}
