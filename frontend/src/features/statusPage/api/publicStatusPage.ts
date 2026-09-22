import { request } from "../../../api/client";
import type { PublicStatusPage } from "../../../types/projectStatusPage";

export const getPublicStatusPage = (slug: string) =>
  request<PublicStatusPage>(`/api/v1/public/status-pages/${encodeURIComponent(slug)}`);
