import { request } from "../../../api/client";
import type { ProjectReadinessEvidenceCoverage, ReadinessArtifactEvidence } from "../../../types/readiness";

const readinessArtifactPath = (projectId: string, itemKey: string) =>
  `/api/v1/projects/${projectId}/readiness/items/${itemKey}/artifacts`;

export const listReadinessItemArtifacts = (projectId: string, itemKey: string) =>
  request<ReadinessArtifactEvidence[]>(readinessArtifactPath(projectId, itemKey));

export const getReadinessEvidenceCoverage = (projectId: string) =>
  request<ProjectReadinessEvidenceCoverage>(`/api/v1/projects/${projectId}/readiness/evidence-coverage`);

export const linkReadinessArtifact = (projectId: string, itemKey: string, artifactId: number) =>
  request<ReadinessArtifactEvidence>(readinessArtifactPath(projectId, itemKey), {
    method: "POST",
    body: JSON.stringify({ artifact_id: artifactId }),
  });

export const unlinkReadinessArtifact = (projectId: string, itemKey: string, artifactId: number) =>
  request<void>(`${readinessArtifactPath(projectId, itemKey)}/${artifactId}`, { method: "DELETE" });
