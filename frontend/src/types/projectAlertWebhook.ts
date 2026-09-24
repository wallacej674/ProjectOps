export interface ProjectAlertWebhook {
  project_id: number;
  enabled: boolean;
  url: string;
  last_delivery_attempted_at: string | null;
  last_delivery_transition: string | null;
  last_delivery_outcome: "delivered" | "failed" | null;
  last_delivery_http_status: number | null;
  last_delivery_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectAlertWebhookUpdateInput {
  enabled: boolean;
  url: string;
}
