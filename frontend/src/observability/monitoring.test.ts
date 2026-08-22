import * as Sentry from "@sentry/react";
import { captureFrontendException, initFrontendMonitoring, isFrontendMonitoringConfigured } from "./monitoring";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
}));

describe("frontend monitoring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays disabled when no DSN is configured", () => {
    expect(isFrontendMonitoringConfigured({ VITE_ENABLE_ERROR_MONITORING: "true", VITE_SENTRY_DSN: "" })).toBe(false);
    expect(initFrontendMonitoring({ VITE_ENABLE_ERROR_MONITORING: "true", VITE_SENTRY_DSN: "" })).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry with safe defaults when enabled", () => {
    const configured = initFrontendMonitoring({
      VITE_ENABLE_ERROR_MONITORING: "true",
      VITE_SENTRY_DSN: "https://public@example.invalid/1",
      VITE_SENTRY_ENVIRONMENT: "private-beta",
      MODE: "production",
    });

    expect(configured).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@example.invalid/1",
        environment: "private-beta",
        sendDefaultPii: false,
      }),
    );
  });

  it("sanitizes sensitive request fields before sending events", () => {
    initFrontendMonitoring({
      VITE_ENABLE_ERROR_MONITORING: "true",
      VITE_SENTRY_DSN: "https://public@example.invalid/1",
      MODE: "production",
    });
    const initOptions = vi.mocked(Sentry.init).mock.calls.at(-1)?.[0];
    const beforeSend = initOptions?.beforeSend;

    const event = {
      request: {
        url: "https://projectops.example/app?token=secret",
        query_string: "token=secret",
        data: { password: "secret" },
        cookies: "session=secret",
        headers: {
          Authorization: "Bearer secret",
          Cookie: "session=secret",
          "X-Request-ID": "safe-id",
        },
      },
    } as unknown as Sentry.ErrorEvent;

    const sanitized = beforeSend?.(event, {}) as Sentry.ErrorEvent | null | undefined;

    expect(sanitized?.request).toEqual({
      url: "https://projectops.example/app",
      query_string: "[Filtered]",
      headers: { "X-Request-ID": "safe-id" },
    });
  });

  it("captures frontend exceptions with request ID context when available", () => {
    initFrontendMonitoring({
      VITE_ENABLE_ERROR_MONITORING: "true",
      VITE_SENTRY_DSN: "https://public@example.invalid/1",
      MODE: "production",
    });
    const error = new Error("render failed");

    captureFrontendException(error, { requestId: "frontend-boundary-123" });

    expect(Sentry.setTag).toHaveBeenCalledWith("request_id", "frontend-boundary-123");
    expect(Sentry.setContext).toHaveBeenCalledWith("projectops", { request_id: "frontend-boundary-123" });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
