import type { HealthCheck } from "./healthCheck";

export interface HealthAlert {
  id: number;
  project_id: number;
  target_url: string;
  status: "active" | "recovered" | "closed";
  first_failure_at: string;
  opened_at: string;
  last_observed_at: string;
  recovered_at: string | null;
  closed_at: string | null;
  first_check_id: number;
  opening_check_id: number;
  latest_check_id: number;
  recovery_check_id: number | null;
  failure_count: number;
  acknowledged_at: string | null;
  acknowledged_by_user_id: number | null;
  closure_reason: string | null;
}
export interface AlertPage { items: HealthAlert[]; total: number }
export interface AlertDetail { alert: HealthAlert; evidence: { items: HealthCheck[]; total: number } }
