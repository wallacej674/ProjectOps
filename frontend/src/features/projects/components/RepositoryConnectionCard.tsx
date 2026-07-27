import { formatDate } from "../../../utils/formatDate";
import type { RepoIntegration } from "../../../types/repoIntegration";
import { RepositoryAttachForm } from "./RepositoryAttachForm";

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
}) {
  return (
    <section className="panel detail-panel repo-panel" aria-labelledby="repo-connection-title">
      <div className="eyebrow">Repository Intake</div>
      <h2 id="repo-connection-title">Repository Connection</h2>
      <p className="repo-intro">
        Attach a public GitHub repository so ProjectOps can understand this project's source structure in later steps.
      </p>
      {loading ? (
        <p className="meta">Loading repository connection...</p>
      ) : repo ? (
        <div className="repo-connected">
          <div className="row">
            <strong>{repo.repo_owner}/{repo.repo_name}</strong>
            <span className="badge healthy">Connected</span>
          </div>
          <dl>
            <div className="definition">
              <dt>Provider</dt>
              <dd>{repo.provider}</dd>
            </div>
            <div className="definition">
              <dt>Repository URL</dt>
              <dd className="mono">{repo.repo_url}</dd>
            </div>
            <div className="definition">
              <dt>Default branch</dt>
              <dd>{repo.default_branch || "Not verified yet"}</dd>
            </div>
            <div className="definition">
              <dt>Last verified</dt>
              <dd>{repo.last_verified_at ? formatDate(repo.last_verified_at) : "Not verified yet"}</dd>
            </div>
          </dl>
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
            ProjectOps stores the repository connection first. CodeMap analysis happens in a later step. Only public
            GitHub repositories are supported right now.
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <RepositoryAttachForm pending={pending} onSubmit={onAttach} />
        </div>
      )}
    </section>
  );
}

