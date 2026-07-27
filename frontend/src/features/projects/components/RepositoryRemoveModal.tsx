import { useFocusTrap } from "../../../hooks/useFocusTrap";
import type { RepoIntegration } from "../../../types/repoIntegration";

export function RepositoryRemoveModal({
  repo,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  repo: RepoIntegration;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useFocusTrap<HTMLElement>(true, onClose);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="repo-remove-title" ref={dialogRef}>
        <div className="eyebrow">Repository Intake</div>
        <h2 id="repo-remove-title">Remove repository connection?</h2>
        <p>
          This removes the ProjectOps connection to {repo.repo_owner}/{repo.repo_name}. It does not delete anything from
          GitHub.
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
            {pending ? "Removing" : "Remove Connection"}
          </button>
        </div>
      </section>
    </div>
  );
}
