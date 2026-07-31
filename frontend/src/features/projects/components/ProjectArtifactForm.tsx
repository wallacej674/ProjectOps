import { useEffect, useState, type FormEvent } from "react";
import type {
  ProjectArtifact,
  ProjectArtifactCreate,
  ProjectArtifactSourceType,
  ProjectArtifactType,
} from "../../../types/projectArtifact";

const artifactTypeOptions: { value: ProjectArtifactType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "document", label: "Document" },
  { value: "link", label: "Link" },
  { value: "runbook", label: "Runbook" },
  { value: "decision", label: "Decision" },
  { value: "incident", label: "Incident" },
  { value: "requirement", label: "Requirement" },
  { value: "risk", label: "Risk" },
  { value: "evidence", label: "Evidence" },
  { value: "other", label: "Other" },
];

const sourceTypeOptions: { value: ProjectArtifactSourceType; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "external_url", label: "External URL" },
  { value: "imported", label: "Imported" },
  { value: "system", label: "System" },
];

function isValidOptionalHttpUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function ProjectArtifactForm({
  artifact,
  pending,
  submitError,
  onSubmit,
  onCancel,
}: {
  artifact?: ProjectArtifact;
  pending: boolean;
  submitError: string;
  onSubmit: (input: ProjectArtifactCreate) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(artifact?.title ?? "");
  const [artifactType, setArtifactType] = useState<ProjectArtifactType>(artifact?.artifact_type ?? "note");
  const [sourceType, setSourceType] = useState<ProjectArtifactSourceType>(artifact?.source_type ?? "manual");
  const [url, setUrl] = useState(artifact?.url ?? "");
  const [summary, setSummary] = useState(artifact?.summary ?? "");
  const [content, setContent] = useState(artifact?.content ?? "");
  const [tags, setTags] = useState(artifact?.tags ?? "");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; url?: string }>({});
  const titleId = artifact ? `artifact-${artifact.id}-title` : "artifact-create-title";
  const urlId = artifact ? `artifact-${artifact.id}-url` : "artifact-create-url";

  useEffect(() => {
    setTitle(artifact?.title ?? "");
    setArtifactType(artifact?.artifact_type ?? "note");
    setSourceType(artifact?.source_type ?? "manual");
    setUrl(artifact?.url ?? "");
    setSummary(artifact?.summary ?? "");
    setContent(artifact?.content ?? "");
    setTags(artifact?.tags ?? "");
    setFieldErrors({});
  }, [artifact]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { title?: string; url?: string } = {};
    if (!title.trim()) nextErrors.title = "Title is required.";
    if (!isValidOptionalHttpUrl(url)) nextErrors.url = "Enter a valid HTTP or HTTPS URL.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      title: title.trim(),
      artifact_type: artifactType,
      source_type: sourceType,
      url: emptyToNull(url),
      summary: emptyToNull(summary),
      content: emptyToNull(content),
      tags: emptyToNull(tags),
    });
  }

  return (
    <form className="artifact-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={titleId}>Title</label>
          <input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby={fieldErrors.title ? `${titleId}-error` : undefined}
            aria-invalid={fieldErrors.title ? "true" : undefined}
            disabled={pending}
          />
          {fieldErrors.title && (
            <div className="error-text" id={`${titleId}-error`}>
              {fieldErrors.title}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${titleId}-type`}>Artifact type</label>
          <select
            id={`${titleId}-type`}
            value={artifactType}
            onChange={(event) => setArtifactType(event.target.value as ProjectArtifactType)}
            disabled={pending}
          >
            {artifactTypeOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${titleId}-source`}>Source type</label>
          <select
            id={`${titleId}-source`}
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as ProjectArtifactSourceType)}
            disabled={pending}
          >
            {sourceTypeOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={urlId}>URL</label>
          <input
            id={urlId}
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-describedby={`${urlId}-hint${fieldErrors.url ? ` ${urlId}-error` : ""}`}
            aria-invalid={fieldErrors.url ? "true" : undefined}
            disabled={pending}
          />
          <div className="hint" id={`${urlId}-hint`}>
            Optional. Use this for external docs, runbooks, decision records, or reference links.
          </div>
          {fieldErrors.url && (
            <div className="error-text" id={`${urlId}-error`}>
              {fieldErrors.url}
            </div>
          )}
        </div>
        <div className="field full">
          <label htmlFor={`${titleId}-summary`}>Summary</label>
          <textarea
            id={`${titleId}-summary`}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            disabled={pending}
          />
        </div>
        <div className="field full">
          <label htmlFor={`${titleId}-content`}>Content</label>
          <textarea
            id={`${titleId}-content`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={pending}
          />
        </div>
        <div className="field full">
          <label htmlFor={`${titleId}-tags`}>Tags</label>
          <input
            id={`${titleId}-tags`}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            aria-describedby={`${titleId}-tags-hint`}
            disabled={pending}
          />
          <div className="hint" id={`${titleId}-tags-hint`}>
            Separate tags with commas.
          </div>
        </div>
      </div>
      {submitError && (
        <p className="error-text" role="alert">
          {submitError}
        </p>
      )}
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Saving" : artifact ? "Save Artifact" : "Create Artifact"}
        </button>
      </div>
    </form>
  );
}
