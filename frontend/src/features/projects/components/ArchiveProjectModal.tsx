import { useState } from "react";
import { projectsApi } from "../../../api/projects";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import type { Project } from "../../../types/project";

/** Confirmation dialog for archiving a Project. Owns the archive request. */
export function ArchiveProjectModal({
  project,
  onClose,
  onSuccess,
}: {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dialogRef = useFocusTrap<HTMLElement>(true, onClose);

  async function archive() {
    setPending(true);
    setError("");
    try {
      await projectsApi.archive(String(project.id));
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project could not be archived.");
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="archive-title" ref={dialogRef}>
        <div className="eyebrow">Archive Project</div>
        <h2 id="archive-title">Archive {project.name}?</h2>
        <p>This keeps the Project and its history, but removes it from the default Project Registry.</p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button" type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button className="button danger" type="button" onClick={archive} disabled={pending}>
            {pending ? "Archiving" : "Archive Project"}
          </button>
        </div>
      </section>
    </div>
  );
}
