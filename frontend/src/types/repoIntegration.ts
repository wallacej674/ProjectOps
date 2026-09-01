export type RepoProvider = "github";

export interface RepoIntegration {
  id: number;
  project_id: number;
  provider: RepoProvider;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  default_branch: string | null;
  is_connected: boolean;
  github_repository_id?: number | null;
  github_installation_id?: number | null;
  is_private?: boolean;
  connection_mode?: "public_url" | "github_app";
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepoIntegrationInput {
  repo_url: string;
}
