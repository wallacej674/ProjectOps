export type ReleaseBrief = { goal: string; stage: 'prototype' | 'private_beta' | 'public_beta' | 'production'; audience: string; critical_journey: string; data_handled: string; failure_outcomes: string; constraints: string; exclusions: string };
export type BriefRevision = { revision: number; content: ReleaseBrief; created_by: number; created_at: string; confirmed_by: number | null; confirmed_at: string | null };
export type Release = { id: number; project_id: number; name: string; version: number; is_active: boolean; archived: boolean; brief: BriefRevision };
export type RequirementContent = { title: string; criterion: string; verification_method: string; consequence: 'high' | 'medium' | 'low'; applicability: 'applicable' | 'not_applicable' | 'undecided'; applicability_reason: string };
export type RequirementRevision = { revision: number; content: RequirementContent; brief_revision_id: number; confirmed_at: string | null; confirmed_by: number | null; created_at: string };
export type ReleaseRequirement = { id: number; version: number; revision: RequirementRevision; state: 'proposed' | 'confirmed' | 'retired'; needs_review: boolean; evidence_state: 'not_verified' };
export type ReleasePage<T> = { items: T[]; total: number };
export type RequirementMaterial = { id: number; artifact_id: number; requirement_revision_id: number; source_changed: boolean; linked_at: string; snapshot: { url: string | null; title: string; summary: string | null; content: string | null; updated_at: string } };
