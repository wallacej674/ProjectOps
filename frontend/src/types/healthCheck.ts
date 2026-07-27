export type HealthCheckStatus = "healthy" | "unhealthy" | "timeout" | "error";

export interface HealthCheck {
  id: number;
  project_id: number;
  target_url: string;
  status: HealthCheckStatus;
  http_status_code: number | null;
  response_time_ms: number | null;
  checked_at: string;
  error_message: string | null;
  response_preview: string | null;
  created_at: string;
}

export interface HealthCheckRunInput {
  url?: string;
}
