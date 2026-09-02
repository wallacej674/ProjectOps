import { request } from "../../../api/client";
import type { ProjectArtifactOverview } from "../../../types/projectArtifact";

export const listCrossProjectArtifactsOverview = () =>
  request<ProjectArtifactOverview[]>("/api/v1/artifacts-overview");
