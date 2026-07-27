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
  created_at: string;
}
