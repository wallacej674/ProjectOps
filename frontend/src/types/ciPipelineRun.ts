export interface CiPipelineRun {
  id: number;
  project_id: number;
  repo_integration_id: number;
  github_run_id: number;
  github_workflow_id: number | null;
  workflow_name: string;
  run_number: number | null;
  status: string;
  conclusion: string | null;
  branch: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  event: string | null;
  html_url: string | null;
  run_started_at: string | null;
  run_completed_at: string | null;
  duration_seconds: number | null;
  observed_at: string;
  created_at: string;
}

export interface CiSyncResult {
  new_count: number;
  updated_count: number;
  latest_run: CiPipelineRun | null;
}

export type CiMonitorCadence = 15 | 60 | 360 | 1440;

export interface CiStatusMonitorSchedule {
  project_id: number;
  enabled: boolean;
  cadence_minutes: CiMonitorCadence;
  next_run_at: string | null;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_outcome: string | null;
  consecutive_sync_failures: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectCiStatusSummary {
  project_id: number;
  project_name: string;
  project_status: string;
  repo_owner: string | null;
  repo_name: string | null;
  ci_available: boolean;
  needs_reauthorization: boolean;
  latest_run: CiPipelineRun | null;
  monitor: CiStatusMonitorSchedule;
}
