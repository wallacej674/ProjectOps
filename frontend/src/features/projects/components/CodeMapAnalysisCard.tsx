import { useEffect, useRef, useState } from "react";
import type { RepoAnalysis } from "../../../types/repoAnalysis";
import type { RepoIntegration } from "../../../types/repoIntegration";
import { formatDate } from "../../../utils/formatDate";

import { RepositoryAnalysisDialog, RepositorySubsystems, SubsystemDetails, type Subsystem } from "./RepositorySubsystems";

const signalLabels: Record<string, string> = {
  has_readme: "README present",
  has_backend: "Backend detected",
  has_frontend: "Frontend detected",
  has_tests: "Tests detected",
  has_ci: "CI detected",
  has_docker: "Docker detected",
  has_env_example: "Environment example detected",
  has_migrations: "Migrations detected",
  has_python: "Python detected",
  has_fastapi: "FastAPI detected",
  has_sqlalchemy: "SQLAlchemy detected",
  has_alembic: "Alembic detected",
  has_react: "React detected",
  has_typescript: "TypeScript detected",
  has_vite: "Vite detected",
};

function stackEntries(analysis: RepoAnalysis) {
  return Object.entries(analysis.detected_stack).filter(([, values]) => Array.isArray(values) && values.length > 0);
}

function displaySignalName(key: string) {
  return signalLabels[key] || key.replaceAll("_", " ");
}

function PathList({ title, paths }: { title: string; paths: string[] }) {
  if (paths.length === 0) return null;
  return (
    <div>
      <h4>{title}</h4>
      <ul className="path-list">
        {paths.map((path) => (
          <li className="mono" key={path}>{path}</li>
        ))}
      </ul>
    </div>
  );
}

function AnalysisHistoryList({
  history,
  loading,
  error,
  latestAnalysis,
}: {
  history: RepoAnalysis[];
  loading: boolean;
  error: string;
  latestAnalysis: RepoAnalysis | null;
}) {
  return (
    <section className="codemap-section" aria-labelledby="codemap-history-title">
      <h3 id="codemap-history-title">Analysis History</h3>
      {loading ? (
        <p className="meta" aria-live="polite">Loading analysis history...</p>
      ) : error ? (
        <p className="error-text" role="alert">{error}</p>
      ) : history.length === 0 ? (
        <p className="meta">No analysis history yet.</p>
      ) : (
        <ol className="history-list">
          {history.map((analysis, index) => (
            <li key={analysis.id}>
              <div className="row">
                <strong>{analysis.status}</strong>
                {(latestAnalysis?.id === analysis.id || index === 0) && <span className="badge healthy">Latest attempt</span>}
              </div>
              <p>{analysis.summary || analysis.error_message || "No summary returned."}</p>
              <div className="meta history-meta">
                <span>{analysis.total_files_scanned} files scanned</span>
                <span>{formatDate(analysis.created_at)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CodeMapAnalysisCard({
  repo,
  repoLoading,
  latestAnalysis,
  analysisLoading,
  analysisRunning,
  analysisError,
  analysisHistory,
  historyLoading,
  historyError,
  onRunAnalysis,
}: {
  repo: RepoIntegration | null;
  repoLoading: boolean;
  latestAnalysis: RepoAnalysis | null;
  analysisLoading: boolean;
  analysisRunning: boolean;
  analysisError: string;
  analysisHistory: RepoAnalysis[];
  historyLoading: boolean;
  historyError: string;
  onRunAnalysis: () => void;
}) {
  const [detail, setDetail] = useState<Subsystem | "All evidence" | "Warnings" | "Run history" | null>(null);
  const isFailed = latestAnalysis?.status === "failed";
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const wasRunningRef = useRef(false);
  const runLabel = analysisRunning ? "Running Analysis" : isFailed ? "Retry Analysis" : latestAnalysis ? "Run Again" : "Run Analysis";

  useEffect(() => {
    if (wasRunningRef.current && !analysisRunning) {
      runButtonRef.current?.focus();
    }
    wasRunningRef.current = analysisRunning;
  }, [analysisRunning]);

  return (
    <section className="panel detail-panel codemap-panel" aria-labelledby="codemap-analysis-title">
      <h2 id="codemap-analysis-title">Repository Analysis</h2>
      <p className="codemap-intro">
        ProjectOps reads repository paths and selected manifests to infer evidence-backed architecture signals. This is
        deterministic analysis, not AI code review.
      </p>
      {repoLoading ? (
        <p className="meta">Checking repository connection before analysis...</p>
      ) : repo ? (
        <div className="codemap-empty">
          <div className="row">
            <strong>{repo.repo_owner}/{repo.repo_name}</strong>
            <span className="badge healthy">Repository connected</span>
          </div>
          {analysisRunning && (
            <p className="meta" aria-live="polite">
              CodeMap Lite analysis is running...
            </p>
          )}
          {analysisLoading ? (
            <p className="meta" aria-live="polite">Loading latest CodeMap Lite analysis...</p>
          ) : analysisError ? (
            <div className="codemap-error">
              <p className="error-text" role="alert">{analysisError}</p>
              <button ref={runButtonRef} className="button primary" type="button" disabled={analysisRunning} onClick={onRunAnalysis}>
                {runLabel}
              </button>
            </div>
          ) : latestAnalysis ? (
            <div className="codemap-result">
              <div className="repository-analysis-meta">
                <span className={`badge ${isFailed ? "archived" : "healthy"}`}>{latestAnalysis.status}</span>
                <span>{latestAnalysis.total_files_scanned} files scanned</span>
                <span>{formatDate(latestAnalysis.created_at)}</span>
                <span>{latestAnalysis.analysis_version === "codemap_medium_v1" ? "Paths and selected manifests" : "Paths only"}</span>
                <button ref={runButtonRef} className="button primary" type="button" disabled={analysisRunning} onClick={onRunAnalysis}>{runLabel}</button>
              </div>

              <p>{latestAnalysis.summary || "CodeMap Lite did not return a summary for this analysis."}</p>
              {isFailed && (
                <section className="codemap-section error" aria-labelledby="codemap-failure-title">
                  <h3 id="codemap-failure-title">What likely happened</h3>
                  <p className="error-text">{latestAnalysis.error_message || "GitHub did not return repository tree data."}</p>
                  <p>
                    GitHub may have rejected the repository tree request, the repository may be unavailable, or the tree
                    response may have been too large to return completely.
                  </p>
                </section>
              )}
              {!isFailed && (
                <>
                  <RepositorySubsystems analysis={latestAnalysis} onInspect={setDetail} />
                  {detail && ["Frontend", "Backend", "Delivery"].includes(detail) && (
                    <RepositoryAnalysisDialog title={detail} onClose={() => setDetail(null)}>
                      <SubsystemDetails analysis={latestAnalysis} name={detail as Subsystem} />
                    </RepositoryAnalysisDialog>
                  )}
                  {detail === "Warnings" && (
                    <RepositoryAnalysisDialog title="Analysis warnings" onClose={() => setDetail(null)}>
                      <ul className="warning-list">{latestAnalysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                    </RepositoryAnalysisDialog>
                  )}
                  {detail === "All evidence" && (
                    <RepositoryAnalysisDialog title="All evidence" onClose={() => setDetail(null)}>
                      <RepositoryInsights analysis={latestAnalysis} />
                      <section className="codemap-section" aria-labelledby="codemap-stack-title">
                        <h3 id="codemap-stack-title">Detected Stack</h3>
                        {stackEntries(latestAnalysis).length > 0 ? (
                          <div className="stack-groups">
                            {stackEntries(latestAnalysis).map(([group, values]) => (
                              <div className="stack-group" key={group}>
                                <h4>{group}</h4>
                                <ul className="chip-list">
                                  {values.map((value) => (
                                    <li key={value}>{value}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="meta">No stack values were detected.</p>
                        )}
                      </section>
                      <section className="codemap-section" aria-labelledby="codemap-signals-title">
                        <h3 id="codemap-signals-title">Architecture Signals</h3>
                        {Object.entries(latestAnalysis.signals).length > 0 ? (
                          <div className="checklist">
                            {Object.entries(latestAnalysis.signals).map(([key, value]) => (
                              <div
                                className={`check-row ${value ? "" : "is-off"}`}
                                key={key}
                                aria-label={`${displaySignalName(key)}: ${value ? "detected" : "not detected"}`}
                              >
                                <span className={`checkbox ${value ? "on" : "off"}`} aria-hidden="true">
                                  {value && (
                                    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 8.5l3 3 7-7" />
                                    </svg>
                                  )}
                                </span>
                                <span>{displaySignalName(key)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="meta">No architecture signals were returned.</p>
                        )}
                      </section>
                      <section className="codemap-section" aria-labelledby="codemap-evidence-title">
                        <h3 id="codemap-evidence-title">Evidence</h3>
                        <div className="evidence-grid">
                          <PathList title="Key files" paths={latestAnalysis.detected_files} />
                          <PathList title="Key folders" paths={latestAnalysis.detected_folders} />
                        </div>
                      </section>
                      <section className="codemap-section" aria-labelledby="codemap-warnings-title">
                        <h3 id="codemap-warnings-title">Warnings</h3>
                        {latestAnalysis.warnings.length > 0 ? (
                          <ul className="warning-list">
                            {latestAnalysis.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="meta">No warnings were returned.</p>
                        )}
                      </section>
                    </RepositoryAnalysisDialog>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <h3>No analysis has been run yet.</h3>
              <p>Run CodeMap Lite to inspect repository paths and detect basic architecture signals.</p>
              <ul className="codemap-facts" aria-label="CodeMap Lite analysis boundaries">
                <li>It does not clone the repository.</li>
                <li>It does not use AI.</li>
                <li>It does not inspect file contents deeply.</li>
                <li>It uses public GitHub repository tree data.</li>
                <li>It detects path-based signals only.</li>
              </ul>
              <button ref={runButtonRef} className="button primary" type="button" disabled={analysisRunning} onClick={onRunAnalysis}>
                {runLabel}
              </button>
            </>
          )}
          <div className="repository-analysis-actions">
            {latestAnalysis && !isFailed && !analysisError && (
              <>
                {latestAnalysis.warnings.length > 0 ? (
                  <button className="repository-detail-link repository-warnings" type="button" onClick={() => setDetail("Warnings")}>
                    {latestAnalysis.warnings.length} analysis {latestAnalysis.warnings.length === 1 ? "warning" : "warnings"} →
                  </button>
                ) : <span className="meta">No warnings were returned.</span>}
                <button className="repository-detail-link" type="button" onClick={() => setDetail("All evidence")}>All evidence →</button>
              </>
            )}
            <button className="repository-detail-link" type="button" onClick={() => setDetail("Run history")}>Run history →</button>
          </div>
          {historyError && detail !== "Run history" && <p className="error-text" role="alert">{historyError}</p>}
          {detail === "Run history" && (
            <RepositoryAnalysisDialog title="Run history" onClose={() => setDetail(null)}>
              <AnalysisHistoryList
                history={analysisHistory}
                loading={historyLoading}
                error={historyError}
                latestAnalysis={latestAnalysis}
              />
            </RepositoryAnalysisDialog>
          )}
        </div>
      ) : (
        <div className="codemap-empty">
          <h3>Attach a GitHub repository before running analysis.</h3>
          <p>
            ProjectOps needs a real repository connection before it can store a RepoAnalysis snapshot. CodeMap Lite uses
            repository file paths only; it does not clone the repository, inspect private code, or use AI.
          </p>
          <a className="link" href="#repo-connection-title">
            Go to Repository Connection
          </a>
          <button className="button" type="button" disabled>
            Run Analysis
          </button>
        </div>
      )}
    </section>
  );
}

function RepositoryInsights({ analysis }: { analysis: RepoAnalysis }) {
  const insights = analysis.insights ?? {};
  const inspectedFiles = analysis.inspected_files ?? [];
  const groups = [
    ["Runtimes", insights.runtimes ?? []],
    ["Frameworks and tools", insights.frameworks ?? []],
    ["Package managers", insights.package_managers ?? []],
    ["Operational signals", insights.operational_signals ?? []],
  ] as const;
  const commands = Object.entries(insights.commands ?? {}).filter(([, values]) => values.length > 0);
  const evidence = Object.entries(analysis.evidence_files ?? {}).filter(([, paths]) => paths.length > 0);
  if (analysis.analysis_version !== "codemap_medium_v1" || inspectedFiles.length === 0) return null;

  return (
    <section className="codemap-section" aria-labelledby="repository-insights-title">
      <h3 id="repository-insights-title">Repository Insights</h3>
      <p className="meta">Deterministic observations from selected manifests and configuration files.</p>
      <div className="stack-groups">
        {groups.filter(([, values]) => values.length > 0).map(([label, values]) => (
          <div className="stack-group" key={label}>
            <h4>{label}</h4>
            <ul className="chip-list">
              {values.map((value) => <li key={value}>{value.replaceAll("_", " ")}</li>)}
            </ul>
          </div>
        ))}
      </div>
      {commands.length > 0 && (
        <div>
          <h4>Declared commands</h4>
          <dl>
            {commands.map(([category, values]) => (
              <div className="definition" key={category}>
                <dt>{category}</dt>
                <dd className="mono">{values.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {insights.dependency_counts && (
        <p className="meta">
          Declared dependencies: {insights.dependency_counts.runtime} runtime, {insights.dependency_counts.development} development.
        </p>
      )}
      <PathList title="Files inspected" paths={inspectedFiles} />
      {evidence.length > 0 && (
        <div>
          <h4>Insight evidence</h4>
          <dl>
            {evidence.map(([signal, paths]) => (
              <div className="definition" key={signal}>
                <dt>{signal.replaceAll("_", " ").replace(":", ": ")}</dt>
                <dd className="mono">{paths.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
