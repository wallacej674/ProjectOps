import type { Project } from "./project";

export type LaunchDecision = "ready" | "review" | "not_ready";
export type LaunchChecklistStatus = "done" | "needs_attention" | "todo";

export interface LaunchReportReadiness {
  score: number | null;
  status: string;
  passed: number;
  failed: number;
  unknown: number;
  not_applicable: number;
  total_applicable: number;
  top_gaps: string[];
}

export interface LaunchEvidenceSummary {
  repository_connected: boolean;
  codemap_completed: boolean;
  health_check_healthy: boolean;
  production_url_configured: boolean;
  active_artifacts: number;
  linked_active_artifacts: number;
  unlinked_active_artifacts: number;
  readiness_items_with_linked_artifacts: number;
  readiness_items_without_linked_artifacts: number;
  total_evidence_links: number;
  activity_events: number;
}

export interface ProjectLaunchReport {
  project: Project;
  generated_at: string;
  decision: LaunchDecision;
  headline: string;
  readiness: LaunchReportReadiness;
  evidence_summary: LaunchEvidenceSummary;
  blockers: string[];
  recommended_actions: string[];
}

export interface LaunchChecklistItem {
  key: string;
  label: string;
  status: LaunchChecklistStatus;
  description: string;
  action: string;
  target: string;
}

export interface LaunchChecklistSummary {
  done: number;
  needs_attention: number;
  todo: number;
  total: number;
}

export interface ProjectLaunchChecklist {
  project: Project;
  generated_at: string;
  summary: LaunchChecklistSummary;
  items: LaunchChecklistItem[];
}
