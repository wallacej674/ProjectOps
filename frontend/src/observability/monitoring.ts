import * as Sentry from "@sentry/react";

type MonitoringEnvironment = {
  VITE_ENABLE_ERROR_MONITORING?: string;
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_ENVIRONMENT?: string;
  MODE?: string;
};

type CaptureContext = {
  requestId?: string;
};

let monitoringEnabled = false;

export function isFrontendMonitoringConfigured(env: MonitoringEnvironment = import.meta.env): boolean {
  return env.VITE_ENABLE_ERROR_MONITORING === "true" && Boolean(env.VITE_SENTRY_DSN?.trim());
}

export function initFrontendMonitoring(env: MonitoringEnvironment = import.meta.env): boolean {
  if (!isFrontendMonitoringConfigured(env)) {
    monitoringEnabled = false;
    return false;
  }

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN?.trim(),
    environment: env.VITE_SENTRY_ENVIRONMENT?.trim() || env.MODE || "local",
    sendDefaultPii: false,
    beforeSend: sanitizeFrontendEvent,
  });
  monitoringEnabled = true;
  return true;
}

export function captureFrontendException(error: unknown, context: CaptureContext = {}) {
  if (!monitoringEnabled) return;

  if (context.requestId) {
    Sentry.setTag("request_id", context.requestId);
    Sentry.setContext("projectops", { request_id: context.requestId });
  }
  Sentry.captureException(error);
}

function sanitizeFrontendEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const request = event.request;
  if (request) {
    delete request.cookies;
    delete request.data;
    if (request.headers) {
      Object.keys(request.headers).forEach((key) => {
        if (["authorization", "cookie", "set-cookie"].includes(key.toLowerCase())) {
          delete request.headers?.[key];
        }
      });
    }
    if (request.url) {
      request.url = request.url.split("?", 1)[0];
    }
    if (request.query_string) {
      request.query_string = "[Filtered]";
    }
  }
  return event;
}
