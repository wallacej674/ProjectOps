import { useState } from "react";

export function RepositoryAttachForm({
  initialUrl = "",
  pending,
  pendingLabel = "Attaching",
  submitLabel = "Attach Repository",
  onSubmit,
}: {
  initialUrl?: string;
  pending: boolean;
  pendingLabel?: string;
  submitLabel?: string;
  onSubmit: (repoUrl: string) => Promise<void>;
}) {
  const [repoUrl, setRepoUrl] = useState(initialUrl);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!repoUrl.trim()) {
      setError("Enter a GitHub repository URL.");
      return;
    }
    setError("");
    await onSubmit(repoUrl.trim());
  }

  return (
    <form className="repo-form" onSubmit={submit} noValidate>
      <div className="field full">
        <label htmlFor="repo-connection-url">GitHub repository URL</label>
        <input
          id="repo-connection-url"
          type="text"
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={`repo-connection-help${error ? " repo-connection-error" : ""}`}
          placeholder="https://github.com/owner/repo"
          disabled={pending}
        />
        <span className="hint" id="repo-connection-help">
          Supported formats: https://github.com/owner/repo, https://github.com/owner/repo.git, or
          git@github.com:owner/repo.git.
        </span>
        {error && (
          <span className="error-text" id="repo-connection-error">
            {error}
          </span>
        )}
      </div>
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
