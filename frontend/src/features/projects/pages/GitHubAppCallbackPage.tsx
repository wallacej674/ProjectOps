import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../../../components/layout/AppShell";
import { completeGitHubAppAuthorization } from "../api/githubApp";

export function GitHubAppCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError("GitHub did not return the required authorization values.");
      return;
    }
    completeGitHubAppAuthorization(code, state)
      .then((result) => navigate(`/app/projects/${result.project_id}?github=connected`, { replace: true }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "GitHub authorization could not be completed."));
  }, [navigate, params]);

  return (
    <AppShell>
      <div className="content">
        <section className="panel detail-panel" aria-labelledby="github-callback-title">
          <h1 id="github-callback-title">Connecting GitHub</h1>
          {error ? <><p className="error-text" role="alert">{error}</p><Link to="/app/projects">Back to Projects</Link></> :
            <p className="meta" aria-live="polite">Verifying your GitHub App installation...</p>}
        </section>
      </div>
    </AppShell>
  );
}
