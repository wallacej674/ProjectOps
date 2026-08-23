import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// These integration tests render the full app and exercise multi-step async
// flows (submit -> navigate -> refetch -> render). Under parallel CPU load the
// default 1000ms async timeout is too tight, so allow more headroom.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000");
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
});
