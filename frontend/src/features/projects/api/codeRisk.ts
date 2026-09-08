import { request } from '../../../api/client';
export function riskRequest<T>(projectId: string, path: string, data?: unknown, method = 'POST') {
  return request<T>(`/api/v1/projects/${projectId}/code-risk${path}`, data === undefined ? {} : { method, body: JSON.stringify(data) });
}
