export type Page<T> = { items: T[]; total: number };
export type RiskTarget = { id: number; name: string; archived: boolean };
export type ToolCoverage = { name: string; version: string; profile: string; outcome: string; covered_files: string[]; errors: string[] };
export type RiskScan = { id: number; target_id: number; outcome: string; imported_at: string; report: { snapshot_hash: string; finished_at: string; tools: ToolCoverage[]; exclusions: string[] } };
export type RiskOccurrence = {
  id: number; finding_id: number; scan_id: number; disposition: string; review_version: number;
  needs_review?: boolean; change?: string;
  review_history: { disposition: string; reason: string; at: string }[];
  evidence: { tool: string; rule_id: string; path: string; line: number | null; severity: string; raw_severity: string; message: string; snippet: string; package?: string; version?: string; versions?: string[]; advisory_url?: string };
};
export type RiskWorkItem = { id: number; title: string; rationale: string; affected_files: string[]; acceptance_checks: string[]; finding_ids: number[]; priority: string; status: string; version: number };
export type SuggestedRiskWork = { title: string; rationale: string; affected_files: string[]; acceptance_checks: string[]; priority: string };
export type RiskExplanation = {
  id: number; occurrence_id: number; context_digest: string; model: string; prompt_version: string;
  status: 'pending' | 'completed' | 'failed'; failure: string | null; created_at: string;
  packet: unknown; usage?: { input_tokens?: number; output_tokens?: number };
  output: null | { explanation: string; impact_prerequisites: string[]; uncertainty: string[];
    proposed_change: string; verification_steps: string[]; citations: string[]; work_item: SuggestedRiskWork };
};
export type RiskExplanationPreview = { available: boolean; unavailable_reason: string; model: string; destination: string; context_digest: string; packet: unknown };
