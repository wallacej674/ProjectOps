import { useState } from "react";
import { formatDate } from "../../../utils/formatDate";
import type { CommandCenterSummary } from "../utils/projectCommandCenter";

type OperationsMapKey =
  | "repository"
  | "codemap"
  | "health"
  | "readiness"
  | "launchDecision"
  | "artifacts"
  | "activity";

type OperationsMapSummary = CommandCenterSummary & { scoreLabel?: string };

export interface ProjectOperationsMapSignals {
  repository: OperationsMapSummary;
  codemap: OperationsMapSummary;
  health: OperationsMapSummary;
  readiness: OperationsMapSummary;
  launchDecision: OperationsMapSummary;
  artifacts: OperationsMapSummary;
  activity: OperationsMapSummary;
}

interface OperationsMapNode {
  key: OperationsMapKey;
  label: string;
  stage: string;
  summary: OperationsMapSummary;
}

function node(
  key: OperationsMapKey,
  label: string,
  stage: string,
  summary: OperationsMapSummary,
): OperationsMapNode {
  return { key, label, stage, summary };
}

function displayMetric(summary: OperationsMapSummary) {
  return summary.scoreLabel || summary.metric;
}

function MapNode({
  item,
  selected,
  onSelect,
}: {
  item: OperationsMapNode;
  selected: boolean;
  onSelect: (key: OperationsMapKey) => void;
}) {
  const metric = displayMetric(item.summary);

  return (
    <button
      className={`operations-node tone-${item.summary.tone}`}
      type="button"
      aria-pressed={selected}
      aria-label={`Inspect ${item.label}: ${item.summary.label}`}
      onClick={() => onSelect(item.key)}
    >
      <span className="operations-node-topline">
        <span className="operations-node-dot" aria-hidden="true" />
        <span>{item.stage}</span>
      </span>
      <strong>{item.label}</strong>
      <span className="operations-node-reading">
        <span>{item.summary.label}</span>
        {metric && <span className="mono">{metric}</span>}
      </span>
    </button>
  );
}

/** Interactive Project evidence topology, designed to grow into deployment topology when that domain exists. */
export function ProjectOperationsMap({ signals }: { signals: ProjectOperationsMapSignals }) {
  const [selectedKey, setSelectedKey] = useState<OperationsMapKey>("repository");
  const primaryNodes = [
    node("repository", "Repository", "Source", signals.repository),
    node("codemap", "CodeMap", "Analysis", signals.codemap),
    node("health", "Production health", "Runtime", signals.health),
    node("readiness", "Readiness", "Review", signals.readiness),
    node("launchDecision", "Launch decision", "Decision", signals.launchDecision),
  ];
  const supportingNodes = [
    node("artifacts", "Artifacts", "Evidence", signals.artifacts),
    node("activity", "Activity", "History", signals.activity),
  ];
  const allNodes = [...primaryNodes, ...supportingNodes];
  const selected = allNodes.find((item) => item.key === selectedKey) ?? primaryNodes[0];
  const selectedMetric = displayMetric(selected.summary);

  return (
    <section className="operations-map" aria-labelledby="operations-map-title">
      <header className="operations-map-header">
        <div>
          <div className="eyebrow">Project map</div>
          <h2 id="operations-map-title">Operational evidence</h2>
          <p>Follow the path from source context to a human launch decision.</p>
        </div>
        <span className="operations-map-current">
          <span aria-hidden="true" /> Current evidence
        </span>
      </header>

      <div className="operations-map-layout">
        <div className="operations-map-canvas">
          <div className="operations-flow" aria-label="Project evidence flow">
            {primaryNodes.map((item) => (
              <div className="operations-node-wrap" key={item.key}>
                <MapNode item={item} selected={selected.key === item.key} onSelect={setSelectedKey} />
              </div>
            ))}
          </div>

          <div className="operations-support" aria-label="Supporting project evidence">
            <span>Supporting evidence</span>
            <div>
              {supportingNodes.map((item) => (
                <MapNode item={item} selected={selected.key === item.key} onSelect={setSelectedKey} key={item.key} />
              ))}
            </div>
          </div>
        </div>

        <aside
          className={`operations-inspector tone-${selected.summary.tone}`}
          aria-label="Selected project signal"
          aria-live="polite"
        >
          <div className="operations-inspector-heading">
            <span>{selected.stage}</span>
            <span className="badge">{selected.summary.label}</span>
          </div>
          <h3>{selected.label}</h3>
          <strong>{selected.summary.title}</strong>
          <p>{selected.summary.detail}</p>
          <dl>
            <div>
              <dt>State</dt>
              <dd className="mono">{selected.summary.state.replaceAll("_", " ")}</dd>
            </div>
            {selectedMetric && (
              <div>
                <dt>Reading</dt>
                <dd className="mono">{selectedMetric}</dd>
              </div>
            )}
            {selected.summary.timestamp && (
              <div>
                <dt>Updated</dt>
                <dd>{formatDate(selected.summary.timestamp)}</dd>
              </div>
            )}
          </dl>
          <a className="button compact" href={`#${selected.summary.targetId}`}>
            Open {selected.label}
          </a>
        </aside>
      </div>
    </section>
  );
}
