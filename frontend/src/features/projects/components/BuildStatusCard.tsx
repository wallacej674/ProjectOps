import { useEffect, useRef, useState } from "react";
import type { CiMonitorCadence, CiPipelineRun, CiStatusMonitorSchedule } from "../../../types/ciPipelineRun";
import type { RepoIntegration } from "../../../types/repoIntegration";
import { formatDate } from "../../../utils/formatDate";

function runTone(run: CiPipelineRun): "success" | "warning" | "danger" | "info" {
  if (run.conclusion === "success") return "success";
  if (run.conclusion === "failure" || run.conclusion === "timed_out") return "danger";
  if (run.conclusion === "cancelled" || run.conclusion === "action_required" || run.conclusion === "stale") return "warning";
  if (run.conclusion) return "warning";
  return "info";
}

function runLabel(run: CiPipelineRun): string {
  if (run.conclusion) return run.conclusion.replaceAll("_", " ");
  if (run.status === "in_progress") return "running";
  if (run.status === "queued") return "queued";
  return run.status.replaceAll("_", " ");
}

function successRate(history: CiPipelineRun[]): number | null {
  const completed = history.filter((run) => run.conclusion !== null).slice(0, 10);
  if (completed.length === 0) return null;
  const successes = completed.filter((run) => run.conclusion === "success").length;
  return Math.round((successes / completed.length) * 100);
}

function RunBadge({ run }: { run: CiPipelineRun }) {
  return (
    <span className={`badge ci-status ${runTone(run)}`} aria-label={`Build status: ${runLabel(run)}`}>
      {runLabel(run)}
    </span>
  );
}

function RunResult({ run }: { run: CiPipelineRun }) {
  return (
    <div className="ci-result">
      <div className="readout">
        <div className="readout-titlebar">
          <span className="readout-dot" aria-hidden="true" />
          <span className="readout-dot" aria-hidden="true" />
          <span className="readout-dot" aria-hidden="true" />
          <span className="readout-title">ci &mdash; {run.workflow_name}</span>
        </div>
        <div className="readout-body">
          <p className="readout-cmd">
            <span className="prompt" aria-hidden="true">&gt;</span> build status --branch {run.branch || "unknown"}
          </p>
          <div className="readout-tiles">
            <div className="readout-tile">
              <span className="readout-tile-label">Conclusion</span>
              <span className={`readout-tile-value tone-${runTone(run)}`}>{runLabel(run).toUpperCase()}</span>
              <span className="readout-tile-note">run #{run.run_number ?? "—"}</span>
            </div>
            <div className="readout-tile">
              <span className="readout-tile-label">Commit</span>
              <span className="readout-tile-value is-text mono">{run.commit_sha ? run.commit_sha.slice(0, 7) : "—"}</span>
            </div>
            <div className="readout-tile">
              <span className="readout-tile-label">Duration</span>
              <span className="readout-tile-value">
                {run.duration_seconds !== null ? <>{run.duration_seconds}<small>s</small></> : "—"}
              </span>
            </div>
            <div className="readout-tile">
              <span className="readout-tile-label">Observed</span>
              <span className="readout-tile-value is-text">{formatDate(run.observed_at)}</span>
            </div>
          </div>
          {run.commit_message && <p className="meta">{run.commit_message}</p>}
          {run.html_url && (
            <p>
              <a className="link" href={run.html_url} target="_blank" rel="noreferrer">
                View on GitHub →
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RunHistoryList({ history, loading, error }: { history: CiPipelineRun[]; loading: boolean; error: string }) {
  return (
    <section className="ci-section" aria-labelledby="ci-history-title">
      <h3 id="ci-history-title">Build History</h3>
      {loading ? (
        <p className="meta" aria-live="polite">Loading build history...</p>
      ) : error ? (
        <p className="error-text" role="alert">{error}</p>
      ) : history.length === 0 ? (
        <p className="meta">No build history yet.</p>
      ) : (
        <ol className="history-list">
          {history.slice(0, 6).map((run, index) => (
            <li key={run.id}>
              <div className="row">
                <strong>{runLabel(run)}</strong>
                {index === 0 && <span className="badge healthy">Latest run</span>}
              </div>
              <p className="meta">{run.workflow_name} on {run.branch || "unknown branch"}</p>
              <div className="meta history-meta">
                <span>run #{run.run_number ?? "—"}</span>
                <span>{run.duration_seconds !== null ? `${run.duration_seconds}s` : "no duration yet"}</span>
                <span>{formatDate(run.observed_at)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function BuildStatusCard({
  repo,
  repoLoading,
  latestRun,
  runLoading,
  runError,
  needsReauthorization,
  runHistory,
  historyLoading,
  historyError,
  monitor,
  monitorLoading,
  monitorPending,
  syncing,
  onSyncNow,
  onUpdateMonitor,
  onPauseMonitor,
}: {
  repo: RepoIntegration | null;
  repoLoading: boolean;
  latestRun: CiPipelineRun | null;
  runLoading: boolean;
  runError: string;
  needsReauthorization: boolean;
  runHistory: CiPipelineRun[];
  historyLoading: boolean;
  historyError: string;
  monitor: CiStatusMonitorSchedule | null;
  monitorLoading: boolean;
  monitorPending: boolean;
  syncing: boolean;
  onSyncNow: () => void;
  onUpdateMonitor: (cadence: CiMonitorCadence) => void;
  onPauseMonitor: () => void;
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cadence, setCadence] = useState<CiMonitorCadence>(60);
  const syncButtonRef = useRef<HTMLButtonElement>(null);
  const configureButtonRef = useRef<HTMLButtonElement>(null);
  const wasSyncingRef = useRef(false);
  const rate = successRate(runHistory);
  const isGitHubApp = Boolean(repo && repo.github_installation_id != null);
  const syncLabel = syncing ? "Syncing" : latestRun ? "Sync now" : "Sync build status";

  useEffect(() => {
    if (wasSyncingRef.current && !syncing) syncButtonRef.current?.focus();
    wasSyncingRef.current = syncing;
  }, [syncing]);

  useEffect(() => {
    if (monitor) setCadence(monitor.cadence_minutes);
  }, [monitor]);

  return (
    <section className="panel detail-panel ci-panel" aria-labelledby="ci-status-title">
      <div className="eyebrow">Build &amp; Deploy</div>
      <h2 id="ci-status-title">Build Status</h2>
      <p className="ci-intro">
        ProjectOps reads GitHub Actions workflow runs for this repository&rsquo;s default branch. This reflects whether
        the repository is currently buildable and deployable, distinct from production uptime.
      </p>

      {repoLoading ? (
        <p className="meta">Checking repository connection before build status...</p>
      ) : !repo ? (
        <div className="ci-empty">
          <h3>Attach a repository before checking build status.</h3>
          <p>ProjectOps needs a connected repository to look up GitHub Actions workflow runs.</p>
          <a className="link" href="#repo-connection-title">Go to Repository Connection</a>
          <button className="button" type="button" disabled>Sync build status</button>
        </div>
      ) : !isGitHubApp ? (
        <div className="ci-empty">
          <h3>Connect via GitHub App to see build status.</h3>
          <p>
            Build status uses the GitHub App installation token so scheduled checks don&rsquo;t share the public,
            unauthenticated rate limit. This repository is currently connected by URL only.
          </p>
          <a className="link" href="#repo-connection-title">Go to Repository Connection</a>
          <button className="button" type="button" disabled>Sync build status</button>
        </div>
      ) : needsReauthorization ? (
        <div className="ci-empty ci-needs-reauth">
          <h3>This GitHub App installation needs updated permissions.</h3>
          <p>
            The GitHub App installation for this repository hasn&rsquo;t granted access to Actions data yet. Re-authorize
            the installation from GitHub to see build status here.
          </p>
          <a className="link" href="#repo-connection-title">Go to Repository Connection</a>
          <button ref={syncButtonRef} className="button" type="button" disabled={syncing} onClick={onSyncNow}>
            {syncing ? "Checking access" : "Try again"}
          </button>
        </div>
      ) : (
        <div className="ci-ready">
          <dl>
            <div className="definition">
              <dt>Repository</dt>
              <dd className="mono">{repo.repo_owner}/{repo.repo_name}</dd>
            </div>
            {repo.default_branch && (
              <div className="definition">
                <dt>Default branch</dt>
                <dd className="mono">{repo.default_branch}</dd>
              </div>
            )}
            {rate !== null && (
              <div className="definition">
                <dt>Recent success rate</dt>
                <dd className="mono">{rate}%</dd>
              </div>
            )}
          </dl>

          <section className="ci-section" aria-labelledby="ci-schedule-title">
            <div className="ci-action-header">
              <h3 id="ci-schedule-title">Scheduled build checks</h3>
              <button
                ref={configureButtonRef}
                className="button"
                type="button"
                aria-expanded={scheduleOpen}
                aria-controls="ci-schedule-form"
                disabled={monitorLoading || monitorPending}
                onClick={() => setScheduleOpen(!scheduleOpen)}
              >
                Configure schedule
              </button>
            </div>
            {monitorLoading ? (
              <p className="meta" aria-live="polite">Loading scheduled build checks...</p>
            ) : (
              <>
                <p>{monitor?.enabled ? "Scheduled build checks are enabled." : "Scheduled build checks are paused."}</p>
                {monitor?.enabled && monitor.next_run_at && <p className="meta">Next check: {formatDate(monitor.next_run_at)}</p>}
                {monitor?.last_completed_at && (
                  <p className="meta">Last sync: {monitor.last_outcome || "unknown"} at {formatDate(monitor.last_completed_at)}</p>
                )}
                {scheduleOpen && (
                  <div id="ci-schedule-form" className="ci-schedule-form">
                    <div className="field">
                      <label htmlFor="ci-monitor-cadence">Check frequency</label>
                      <select
                        id="ci-monitor-cadence"
                        value={cadence}
                        disabled={monitorPending}
                        onChange={(event) => setCadence(Number(event.target.value) as CiMonitorCadence)}
                      >
                        <option value={15}>Every 15 minutes</option>
                        <option value={60}>Every hour</option>
                        <option value={360}>Every 6 hours</option>
                        <option value={1440}>Daily</option>
                      </select>
                    </div>
                    <div className="ci-action-group">
                      <button className="button" type="button" disabled={monitorPending} onClick={() => onUpdateMonitor(cadence)}>
                        {monitorPending ? "Saving schedule" : monitor?.enabled ? "Update schedule" : "Enable scheduled checks"}
                      </button>
                      {monitor?.enabled && (
                        <button className="button" type="button" disabled={monitorPending} onClick={onPauseMonitor}>
                          Pause scheduled checks
                        </button>
                      )}
                      <button
                        className="button ghost"
                        type="button"
                        disabled={monitorPending}
                        onClick={() => {
                          setCadence(monitor?.cadence_minutes ?? 60);
                          setScheduleOpen(false);
                          configureButtonRef.current?.focus();
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="ci-section latest-ci" aria-labelledby="latest-ci-title">
            <div className="ci-action-header">
              <div className="ci-action-group">
                <h3 id="latest-ci-title">Latest Run</h3>
                {latestRun && <RunBadge run={latestRun} />}
              </div>
              <button ref={syncButtonRef} className="button primary" type="button" disabled={syncing} onClick={onSyncNow}>
                {syncLabel}
              </button>
            </div>
            {syncing && <p className="meta" aria-live="polite">Syncing with GitHub Actions...</p>}
            {runLoading ? (
              <p className="meta" aria-live="polite">Loading latest build status...</p>
            ) : runError ? (
              <p className="error-text" role="alert">{runError}</p>
            ) : latestRun ? (
              <RunResult run={latestRun} />
            ) : (
              <>
                <h3>No build status has been synced yet.</h3>
                <p>Sync now to fetch the latest GitHub Actions workflow runs for the default branch.</p>
              </>
            )}
          </section>

          <RunHistoryList history={runHistory} loading={historyLoading} error={historyError} />
        </div>
      )}
    </section>
  );
}
