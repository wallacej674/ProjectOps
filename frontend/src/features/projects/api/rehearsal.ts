import { request } from '../../../api/client';

export function rehearsalRequest<T>(base: string, path: string, body?: unknown, method = 'POST'): Promise<T> {
  return request<T>(`${base}${path}`, body === undefined ? {} : { method, body: JSON.stringify(body) });
}

export function parseImport(text: string): unknown {
  if (new TextEncoder().encode(text).length > 256 * 1024) throw new Error('Import exceeds 256 KiB. Reduce the selected report.');
  try { return JSON.parse(text); } catch { throw new Error('Enter valid JSON before previewing the import.'); }
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
