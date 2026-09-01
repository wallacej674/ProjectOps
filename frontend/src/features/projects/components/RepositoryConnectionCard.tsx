import { useEffect, useState } from "react";
import { formatDate } from "../../../utils/formatDate";
import type { RepoIntegration } from "../../../types/repoIntegration";
import { RepositoryAttachForm } from "./RepositoryAttachForm";
import { getGitHubAppAuthorization, listGitHubAppRepositories, type GitHubRepositoryChoice } from "../api/githubApp";

export function RepositoryConnectionCard({
  repo,
  loading,
  error,
  pending,
  replaceMode,
  onStartReplace,
  onCancelReplace,
  onRemove,
  onAttach,
  onGitHubAppAttach,
}: {
  repo: RepoIntegration | null;
  loading: boolean;
  error: string;
  pending: boolean;
  replaceMode: boolean;
  onStartReplace: () => void;
  onCancelReplace: () => void;
  onRemove: () => void;
  onAttach: (repoUrl: string) => Promise<void>;
  onGitHubAppAttach: (installationId: number, repositoryId: number) => Promise<void>;
}) {
  const [appEnabled, setAppEnabled] = useState(false);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepositoryChoice[]>([]);
  const [selected, setSelected] = useState("");
  const projectId = repo?.project_id?.toString() ?? window.location.pathname.split("/").filter(Boolean).at(-1) ?? "";

  useEffect(() => {
    if (!projectId) return;
    getGitHubAppAuthorization(projectId).then((status) => {
      setAppEnabled(status.enabled);
      setAuthorizeUrl(status.authorize_url);
      if (status.enabled) return listGitHubAppRepositories(projectId).then(setRepositories).catch(() => setRepositories([]));
    }).catch(() => setAppEnabled(false));
  }, [projectId]);
  return (
    <section className="panel detail-panel repo-panel" aria-labelledby="repo-connection-title">
      <div className="eyebrow">Repository Intake</div>
      <h2 id="repo-connection-title">Repository Connection</h2>
      <p className="repo-intro">
        Connect a GitHub repository so ProjectOps can understand this project's source structure in later steps.
      </p>
      {loading ? (
        <p className="meta">Loading repository connection...</p>
      ) : repo ? (
        <div className="repo-connected">
          <div className="row">
            <strong>{repo.repo_owner}/{repo.repo_name}</strong>
            <span className="badge healthy">Connected</span>
          </div>

          <div className="readout">
            <div className="readout-titlebar">
              <span className="readout-dot" aria-hidden="true" />
              <span className="readout-dot" aria-hidden="true" />
              <span className="readout-dot" aria-hidden="true" />
              <span className="readout-title">
                repo &mdash; {repo.repo_owner}/{repo.repo_name}
              </span>
            </div>
            <div className="readout-body">
              <p className="readout-cmd">
                <span className="prompt" aria-hidden="true">
                  &gt;
                </span>{" "}
                repo view {repo.repo_owner}/{repo.repo_name}
              </p>

              <div className="readout-tiles">
                <div className="readout-tile">
                  <span className="readout-tile-label">Provider</span>
                  <span className="readout-tile-value is-text">{repo.provider}</span>
                </div>
                <div className="readout-tile">
                  <span className="readout-tile-label">Visibility</span>
                  <span className="readout-tile-value is-text">{repo.is_private ? "Private" : "Public"}</span>
                </div>
                <div className="readout-tile">
                  <span className="readout-tile-label">Default branch</span>
                  <span className="readout-tile-value is-text">{repo.default_branch || "Not verified"}</span>
                </div>
                <div className="readout-tile">
                  <span className="readout-tile-label">Last verified</span>
                  <span className="readout-tile-value is-text">
                    {repo.last_verified_at ? formatDate(repo.last_verified_at) : "Not verified"}
                  </span>
                </div>
              </div>

              <div className="readout-log">
                <p className="readout-log-heading">
                  <span className="prompt" aria-hidden="true">
                    &rsaquo;
                  </span>{" "}
                  url
                </p>
                <p className="readout-pre mono">{repo.repo_url}</p>
                <span className="readout-cursor" aria-hidden="true" />
              </div>
            </div>
          </div>
          {replaceMode ? (
            <div className="repo-replace">
              <p className="meta">
                Replacing updates the repository connected to this Project. It does not run CodeMap analysis.
              </p>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <RepositoryAttachForm
                initialUrl={repo.repo_url}
                pending={pending}
                pendingLabel="Replacing"
                submitLabel="Replace Repository"
                onSubmit={onAttach}
              />
              <button className="button" type="button" disabled={pending} onClick={onCancelReplace}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="repo-actions">
              <button className="button" type="button" onClick={onStartReplace}>
                Replace Repository
              </button>
              <button className="button danger" type="button" onClick={onRemove}>
                Remove Repository
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="repo-empty">
          <h3>No repository connected</h3>
          <p>
            ProjectOps stores the repository connection first. CodeMap analysis happens in a later step. Public
            repositories can be attached by URL; authorized private repositories can be selected through the
            configured GitHub App.
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <RepositoryAttachForm pending={pending} onSubmit={onAttach} />
          {appEnabled && (
            <div className="repo-replace">
              <h3>Connect with GitHub App</h3>
              <p className="meta">Use read-only installation access for private repositories. ProjectOps does not store your GitHub user token.</p>
              {repositories.length > 0 ? (
                <>
                  <label htmlFor="github-app-repository">Available repository</label>
                  <select id="github-app-repository" value={selected} onChange={(event) => setSelected(event.target.value)}>
                    <option value="">Select a repository</option>
                    {repositories.map((item) => <option key={`${item.installation_id}:${item.id}`} value={`${item.installation_id}:${item.id}`}>{item.full_name}{item.private ? " (private)" : ""}</option>)}
                  </select>
                  <button className="button primary" type="button" disabled={!selected || pending} onClick={() => {
                    const [installationId, repositoryId] = selected.split(":").map(Number);
                    void onGitHubAppAttach(installationId, repositoryId);
                  }}>Attach selected repository</button>
                </>
              ) : authorizeUrl ? (
                <a className="button" href={authorizeUrl}>Connect GitHub App</a>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

