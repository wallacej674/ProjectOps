import type { HealthCheckStatus } from "./healthCheck";

export interface ProjectStatusPage {
  project_id: number;
  enabled: boolean;
  slug: string | null;
  label: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectStatusPageUpdateInput {
  enabled: boolean;
  label?: string | null;
}

export interface PublicStatusCheck {
  status: HealthCheckStatus;
  http_status_code: number | null;
  response_time_ms: number | null;
  checked_at: string;
}

export interface PublicStatusIncident {
  opened_at: string;
  last_observed_at: string;
  recovered_at: string | null;
}

export interface PublicStatusPage {
  label: string;
  target_url: string | null;
  current_status: HealthCheckStatus | null;
  last_checked_at: string | null;
  active_incident: PublicStatusIncident | null;
  history: PublicStatusCheck[];
  generated_at: string;
}
