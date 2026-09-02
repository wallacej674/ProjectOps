export type ProjectArtifactType =
  | "note"
  | "document"
  | "link"
  | "runbook"
  | "decision"
  | "incident"
  | "requirement"
  | "risk"
  | "evidence"
  | "other";

export type ProjectArtifactSourceType = "manual" | "external_url" | "imported" | "system";

export type ProjectArtifactStatus = "active" | "archived";

export interface ProjectArtifactCreator {
  id: number;
  email: string;
  display_name: string | null;
}

export interface ProjectArtifact {
  id: number;
  project_id: number;
  created_by_user_id: number | null;
  created_by_user: ProjectArtifactCreator | null;
  title: string;
  artifact_type: ProjectArtifactType;
  source_type: ProjectArtifactSourceType;
  url: string | null;
  content: string | null;
  summary: string | null;
  tags: string | null;
  status: ProjectArtifactStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectArtifactCreate {
  title: string;
  artifact_type: ProjectArtifactType;
  source_type: ProjectArtifactSourceType;
  url?: string | null;
  content?: string | null;
  summary?: string | null;
  tags?: string | null;
}

export type ProjectArtifactUpdate = Partial<ProjectArtifactCreate> & {
  status?: ProjectArtifactStatus;
};

export interface ProjectArtifactListOptions {
  includeArchived?: boolean;
  artifactType?: ProjectArtifactType | "";
  sourceType?: ProjectArtifactSourceType | "";
  search?: string;
  tags?: string[];
}

export interface ProjectArtifactOverview {
  project_id: number;
  project_name: string;
  project_status: string;
  active_artifact_count: number;
  most_recent_title: string | null;
  most_recent_updated_at: string | null;
}
