import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProjectInput } from "../../../types/project";
import { blankInput, editableStatuses, normalizeInput } from "../projectForm";

/** Create/edit form for a Project. Validation and submit state live here. */
export function ProjectForm({
  initial = blankInput,
  submitLabel,
  onSubmit,
}: {
  initial?: ProjectInput;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [apiError, setApiError] = useState("");
  const set = (key: keyof ProjectInput, value: string) => setData((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!data.name.trim()) next.name = "Enter a Project name.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    setApiError("");
    try {
      await onSubmit(normalizeInput(data));
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Changes could not be saved.");
      setPending(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      {apiError && (
        <p className="error-text" role="alert">
          {apiError}
        </p>
      )}
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="name">Project name</label>
          <input
            id="name"
            value={data.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <span className="error-text" id="name-error">
              {errors.name}
            </span>
          )}
        </div>
        <div className="field full">
          <label htmlFor="description">
            Description <span className="meta">optional</span>
          </label>
          <textarea id="description" value={data.description || ""} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="status">Project status</label>
          <select id="status" value={data.status} onChange={(e) => set("status", e.target.value)}>
            {editableStatuses.map((s) => (
              <option value={s} key={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="repo">
            Repository URL <span className="meta">optional</span>
          </label>
          <input id="repo" type="url" value={data.repo_url || ""} onChange={(e) => set("repo_url", e.target.value)} />
          <span className="hint">Project metadata only; no repository connection is created.</span>
        </div>
        <div className="field full">
          <label htmlFor="production">
            Production URL <span className="meta">optional</span>
          </label>
          <input
            id="production"
            type="url"
            value={data.production_url || ""}
            onChange={(e) => set("production_url", e.target.value)}
          />
          <span className="hint">You can add this later during project setup.</span>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="button" disabled={pending} onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button className="button primary" disabled={pending}>
          {pending ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}
