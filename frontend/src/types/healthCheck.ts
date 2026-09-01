export type HealthCheckStatus = "healthy" | "unhealthy" | "timeout" | "error";

export interface HealthCheck {
  id: number;
  project_id: number;
  target_url: string;
  status: HealthCheckStatus;
  execution_source?: "manual" | "scheduled";
  http_status_code: number | null;
  response_time_ms: number | null;
  checked_at: string;
  error_message: string | null;
  response_preview: string | null;
  created_at: string;
}

export type HealthMonitorCadence = 15 | 60 | 360 | 1440;

export interface HealthMonitorSchedule {
  project_id: number;
  enabled: boolean;
  cadence_minutes: HealthMonitorCadence;
  next_run_at: string | null;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_outcome: HealthCheckStatus | null;
  consecutive_failures: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface HealthCheckRunInput {
  url?: string;
}
