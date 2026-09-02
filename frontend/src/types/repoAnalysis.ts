export type RepoAnalysisStatus = "completed" | "failed";

export interface RepoAnalysis {
  id: number;
  project_id: number;
  repo_integration_id: number;
  status: RepoAnalysisStatus;
  summary: string | null;
  detected_stack: Record<string, string[]>;
  detected_files: string[];
  detected_folders: string[];
  signals: Record<string, boolean>;
  warnings: string[];
  error_message: string | null;
  total_files_scanned: number;
  analysis_version?: string;
  insights?: {
    runtimes?: string[];
    package_managers?: string[];
    frameworks?: string[];
    commands?: Record<string, string[]>;
    dependency_counts?: { runtime: number; development: number };
    operational_signals?: string[];
  };
  evidence_files?: Record<string, string[]>;
  inspected_files?: string[];
  created_at: string;
}

export interface ProjectRepoAnalysisOverview {
  project_id: number;
  project_name: string;
  project_status: string;
  repo_owner: string | null;
  repo_name: string | null;
  latest_status: RepoAnalysisStatus | null;
  summary: string | null;
  total_files_scanned: number | null;
  analyzed_at: string | null;
}
