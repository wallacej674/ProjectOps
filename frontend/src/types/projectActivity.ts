export type ProjectActivityCategory =
  | "project"
  | "repository"
  | "codemap"
  | "health"
  | "readiness"
  | "artifact"
  | "evidence";

export type ProjectActivityEventType =
  | "project_created"
  | "project_updated"
  | "project_archived"
  | "repository_attached"
  | "repository_replaced"
  | "repository_removed"
  | "codemap_analysis_completed"
  | "codemap_analysis_failed"
  | "health_alert_opened"
  | "health_alert_acknowledged"
  | "health_alert_recovered"
  | "health_alert_closed"
  | "health_check_healthy"
  | "health_check_unhealthy"
  | "health_check_timeout"
  | "health_check_error"
  | "readiness_evaluated"
  | "readiness_manual_item_updated"
  | "artifact_created"
  | "artifact_updated"
  | "artifact_archived"
  | "readiness_artifact_linked"
  | "readiness_artifact_unlinked";

export type ProjectActivityMetadata = Record<string, unknown>;

export interface ProjectActivityEvent {
  id: number;
  project_id: number;
  event_type: ProjectActivityEventType;
  event_category: ProjectActivityCategory;
  message: string;
  related_resource_type: string | null;
  related_resource_id: number | null;
  metadata: ProjectActivityMetadata | null;
  created_at: string;
}

export interface ProjectActivityFilters {
  category?: ProjectActivityCategory | "";
  eventType?: ProjectActivityEventType | "";
  projectId?: number;
  limit?: number;
  offset?: number;
}

export interface CrossProjectActivityEvent extends ProjectActivityEvent {
  project_name: string;
  project_status: string;
}
