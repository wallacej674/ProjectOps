export type RehearsalScope = { id: number; version: number; source: { target: string | null; snapshot: string | null; files: Record<string, string>; coverage: 'partial' | 'complete' }; environment: string | null };
export type Evidence = { id: number; requirement_id: number; requirement_revision: number; scope_id: number; kind: string; origin: string; digest: string; payload: unknown; limitations: string[]; created_at: string };
export type RehearsalRequirement = { id: number; title: string; requirement_revision: number; criterion: string; verification_method: string; consequence: string; applicability: string; state: string; outcome: string; freshness: string; reasons: string[]; assessment_id: number | null; disposition: string };
export type NextStep = { id: number; version: number; title: string; status: string; rationale: string; requirement_ids: number[]; acceptance_checks: string[]; dependencies: number[]; priority_rationale?: string; provenance?: { origin: string; model?: string }; history?: unknown[] };
export type RehearsalSummary = { scope: RehearsalScope | null; requirements: RehearsalRequirement[]; next_steps: NextStep[]; limitations: string[] };
export type Assessment = { id: number; version: number; requirement_id: number; outcome: string; rationale: string; evidence_ids: number[]; limitations: string[]; status?: string; review_status?: string; freshness?: string; provenance?: { origin: string; model?: string }; reviews?: unknown[] };
export type Workflow = { id: number; status: string; failure?: string | null; usage?: unknown; manifest?: unknown; output?: unknown; created_at?: string; warning?: string | null };
export type Packet = { id: number; digest: string; manifest: unknown; markdown: string };
export type Decision = { id: number; decision: string; reason: string; created_at: string; manifest: unknown };
export type Page<T> = { items: T[]; total: number };
export type RehearsalPanelProps = { base: string; summary: RehearsalSummary; disabled: boolean; reload: () => void };

