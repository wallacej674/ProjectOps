import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { resolveApiBaseUrl } from "../../../api/client";
import type { ProjectStatusPage } from "../../../types/projectStatusPage";

function publicStatusUrl(slug: string): string {
  return `${window.location.origin}/status/${slug}`;
}

function publicBadgeUrl(slug: string): string {
  return `${resolveApiBaseUrl()}/api/v1/public/status-pages/${slug}/badge.svg`;
}

function badgeMarkdown(slug: string): string {
  return `[![Status](${publicBadgeUrl(slug)})](${publicStatusUrl(slug)})`;
}

export function StatusPageCard({
  projectId,
  page,
  loading,
  error,
  pending,
  productionUrl,
  onEnable,
  onPause,
  onRotateSlug,
}: {
  projectId: number;
  page: ProjectStatusPage | null;
  loading: boolean;
  error: string;
  pending: boolean;
  productionUrl: string | null;
  onEnable: (label: string | null) => void;
  onPause: () => void;
  onRotateSlug: () => void;
}) {
  const [label, setLabel] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"link" | "badge" | null>(null);

  useEffect(() => {
    setLabel(page?.label ?? "");
  }, [page?.label]);

  async function copyText(target: "link" | "badge", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      setCopiedTarget(null);
    }
  }

  return (
    <section className="panel detail-panel status-page-panel" aria-labelledby="status-page-title">
      <div className="eyebrow">Public Trust Surface</div>
      <h2 id="status-page-title">Public Status Page</h2>
      <p>
        Publishes a read-only page showing this Project&apos;s current and recent Health Check observations to
        anyone with the link. It is not an uptime guarantee &mdash; only what ProjectOps has observed.
      </p>
      {!productionUrl ? (
        <div className="health-empty">
          <h3>Add a production URL before publishing a status page.</h3>
          <p>A status page shows Health Check history for the Project&apos;s production URL.</p>
          <Link className="link" to={`/app/projects/${projectId}/edit`}>
            Edit Project
          </Link>
        </div>
      ) : loading ? (
        <p className="meta" aria-live="polite">Loading status page settings...</p>
      ) : (
        <div className="status-page-settings">
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="field">
            <label htmlFor="status-page-label">Public display name</label>
            <input
              id="status-page-label"
              type="text"
              maxLength={200}
              placeholder="Defaults to the Project name"
              value={label}
              disabled={pending}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="health-action-group">
            {page?.enabled ? (
              <>
                <button className="button" type="button" disabled={pending} onClick={() => onEnable(label || null)}>
                  {pending ? "Saving" : "Save display name"}
                </button>
                <button className="button" type="button" disabled={pending} onClick={onPause}>
                  Unpublish status page
                </button>
              </>
            ) : (
              <button className="button primary" type="button" disabled={pending} onClick={() => onEnable(label || null)}>
                {pending ? "Publishing" : "Publish status page"}
              </button>
            )}
          </div>
          {page?.slug && (
            <div className="status-page-link">
              <p>
                <span className="badge">{page.enabled ? "Published" : "Unpublished"}</span>{" "}
                {page.enabled ? "Anyone with this link can view current status:" : "Link is saved but not publicly reachable while unpublished:"}
              </p>
              <p className="mono">{publicStatusUrl(page.slug)}</p>
              <div className="health-action-group">
                <button className="button" type="button" onClick={() => void copyText("link", publicStatusUrl(page.slug as string))}>
                  {copiedTarget === "link" ? "Copied" : "Copy link"}
                </button>
                {page.enabled && (
                  <a className="button" href={`/status/${page.slug}`} target="_blank" rel="noreferrer">
                    Open status page
                  </a>
                )}
                <button className="button ghost" type="button" disabled={pending} onClick={onRotateSlug}>
                  Rotate link
                </button>
              </div>
              <p className="hint">Rotating immediately breaks the link above; anyone using it will see a 404.</p>
              {page.enabled && (
                <div className="status-page-badge">
                  <p>Embed a live status badge in a README or docs page:</p>
                  <img src={publicBadgeUrl(page.slug)} alt={`Status badge for ${page.label ?? "this Project"}`} width={112} height={20} />
                  <p className="mono status-page-badge-markdown">{badgeMarkdown(page.slug)}</p>
                  <button className="button" type="button" onClick={() => void copyText("badge", badgeMarkdown(page.slug as string))}>
                    {copiedTarget === "badge" ? "Copied" : "Copy badge markdown"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
