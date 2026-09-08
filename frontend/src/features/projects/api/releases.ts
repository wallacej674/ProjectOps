import { request } from '../../../api/client';
export const releaseRequest = <T,>(projectId: string, path = '', data?: unknown, method = 'POST') =>
  request<T>(`/api/v1/projects/${projectId}/releases${path}`, data === undefined ? {} : { method, body: JSON.stringify(data) });
