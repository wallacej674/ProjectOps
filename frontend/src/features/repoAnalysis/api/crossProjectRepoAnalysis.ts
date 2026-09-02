import { request } from "../../../api/client";
import type { ProjectRepoAnalysisOverview } from "../../../types/repoAnalysis";

export const listCrossProjectRepoAnalysis = () =>
  request<ProjectRepoAnalysisOverview[]>("/api/v1/repo-analyses");
