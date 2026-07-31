export type ApiErrorKind = "validation" | "not-found" | "network" | "configuration" | "unknown";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiEnvironment = {
  VITE_API_BASE_URL?: string;
  PROD?: boolean;
};

export function resolveApiBaseUrl(env: ApiEnvironment = import.meta.env): string {
  const configuredUrl = env.VITE_API_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  if (env.PROD) {
    throw new ApiError("ProjectOps API URL is not configured. Set VITE_API_BASE_URL for this deployment.", "configuration");
  }
  return "http://127.0.0.1:8000";
}

function messageFromDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg ?? "Invalid value").join(" ");
  return "The request could not be completed.";
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError("ProjectOps could not reach the API.", "network");
  }

  const text = await response.text();
  const data: unknown = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  if (!response.ok) {
    const detail = typeof data === "object" && data !== null && "detail" in data ? (data as { detail: unknown }).detail : data;
    const kind: ApiErrorKind = response.status === 422 ? "validation" : response.status === 404 ? "not-found" : "unknown";
    throw new ApiError(messageFromDetail(detail), kind, response.status, detail);
  }
  return data as T;
}
