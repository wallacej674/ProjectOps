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

export interface ReadinessItemUpdate {
  status: ReadinessStatus;
  notes?: string | null;
}
