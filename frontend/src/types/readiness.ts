import type { ProjectArtifact } from "./projectArtifact";

export const readinessStatuses = ["passed", "failed", "unknown", "not_applicable"] as const;

export type ReadinessStatus = (typeof readinessStatuses)[number];

export type ReadinessSource = "codemap" | "health_check" | "project" | "manual";

export type ReadinessEvaluationType = "automatic" | "manual";

export interface ReadinessCatalogItem {
  id: number;
  key: string;
  label: string;
  description: string;
  category: string;
  evaluation_type: ReadinessEvaluationType;
  sort_order: number;
  is_active: boolean;
}

export interface ProjectReadinessItem {
  id: number;
  project_id: number;
  readiness_item_id: number;
  item: ReadinessCatalogItem;
  status: ReadinessStatus;
  source: ReadinessSource;
  evidence: Record<string, unknown> | null;
  notes: string | null;
  evaluated_at: string;
}

export interface ProjectReadinessSummary {
  score: number | null;
  status: string;
  passed: number;
  failed: number;
  unknown: number;
  not_applicable: number;
  total_applicable: number;
  top_gaps: string[];
  items: ProjectReadinessItem[];
}

export interface ProjectReadinessOverview {
  project_id: number;
  project_name: string;
  project_status: string;
  score: number | null;
  status: string;
  passed: number;
  failed: number;
  unknown: number;
  not_applicable: number;
  total_applicable: number;
  top_gaps: string[];
}

export interface ReadinessItemUpdate {
  status: ReadinessStatus;
  notes?: string | null;
}

export interface ReadinessArtifactEvidence {
  id: number;
  project_id: number;
  readiness_item_id: number;
  item_key: string;
  artifact: ProjectArtifact;
  created_at: string;
}

export interface ReadinessEvidenceItemUsage {
  readiness_item_id: number;
  item_key: string;
  label: string;
  status: ReadinessStatus | null;
}

export interface ReadinessEvidenceArtifactUsage {
  artifact: ProjectArtifact;
  linked_item_count: number;
  readiness_items: ReadinessEvidenceItemUsage[];
}

export interface ReadinessEvidenceItemCoverage {
  readiness_item_id: number;
  item_key: string;
  label: string;
  status: ReadinessStatus;
  linked_artifact_count: number;
  artifacts: ProjectArtifact[];
}

export interface ProjectReadinessEvidenceCoverage {
  active_artifacts: number;
  linked_active_artifacts: number;
  unlinked_active_artifacts: number;
  readiness_items_with_linked_artifacts: number;
  readiness_items_without_linked_artifacts: number;
  total_evidence_links: number;
  artifact_usage: ReadinessEvidenceArtifactUsage[];
  readiness_items: ReadinessEvidenceItemCoverage[];
}
