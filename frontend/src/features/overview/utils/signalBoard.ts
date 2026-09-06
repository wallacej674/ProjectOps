import { productionCheck } from "../../health/productionHealth";
import type { ProjectArtifactOverview } from "../../../types/projectArtifact";
import type { ProjectHealthSummary } from "../../../types/healthCheck";
import type { ProjectReadinessOverview } from "../../../types/readiness";
import type { ProjectRepoAnalysisOverview } from "../../../types/repoAnalysis";

export type SignalTone = "success" | "warning" | "danger" | "neutral";

export interface SignalBucket {
  label: string;
  tone: SignalTone;
  count: number;
}

export interface SignalSummary {
  total: number;
  buckets: SignalBucket[];
}

function summary(buckets: SignalBucket[]): SignalSummary {
  return { total: buckets.reduce((sum, bucket) => sum + bucket.count, 0), buckets };
}

export function summarizeHealthSignal(rows: ProjectHealthSummary[]): SignalSummary {
  let healthy = 0;
  let down = 0;
  let unchecked = 0;
  rows.forEach((row) => {
    if (!row.production_url || !productionCheck(row)) {
      unchecked += 1;
    } else if (productionCheck(row)?.status === "healthy" && !row.monitor?.active_alert && row.monitor?.freshness !== "overdue") {
      healthy += 1;
    } else {
      down += 1;
    }
  });
  return summary([
    { label: "healthy", tone: "success", count: healthy },
    { label: "needs attention", tone: "danger", count: down },
    { label: "unchecked", tone: "neutral", count: unchecked },
  ]);
}

export function summarizeReadinessSignal(rows: ProjectReadinessOverview[]): SignalSummary {
  let strong = 0;
  let inProgress = 0;
  let needsWork = 0;
  let notStarted = 0;
  rows.forEach((row) => {
    if (row.status === "strong") strong += 1;
    else if (row.status === "needs_work") needsWork += 1;
    else if (row.status === "in_progress") inProgress += 1;
    else notStarted += 1;
  });
  return summary([
    { label: "strong", tone: "success", count: strong },
    { label: "in progress", tone: "warning", count: inProgress },
    { label: "needs work", tone: "danger", count: needsWork },
    { label: "not evaluated", tone: "neutral", count: notStarted },
  ]);
}

export function summarizeRepoAnalysisSignal(rows: ProjectRepoAnalysisOverview[]): SignalSummary {
  let completed = 0;
  let failed = 0;
  let notConnected = 0;
  rows.forEach((row) => {
    if (row.latest_status === "completed") completed += 1;
    else if (row.latest_status === "failed") failed += 1;
    else notConnected += 1;
  });
  return summary([
    { label: "completed", tone: "success", count: completed },
    { label: "failed", tone: "danger", count: failed },
    { label: "not connected", tone: "neutral", count: notConnected },
  ]);
}

export function summarizeArtifactsSignal(rows: ProjectArtifactOverview[]): SignalSummary {
  let withArtifacts = 0;
  let empty = 0;
  rows.forEach((row) => {
    if (row.active_artifact_count > 0) withArtifacts += 1;
    else empty += 1;
  });
  return summary([
    { label: "with artifacts", tone: "success", count: withArtifacts },
    { label: "empty", tone: "neutral", count: empty },
  ]);
}
