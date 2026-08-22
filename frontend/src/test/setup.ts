import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { afterEach } from "vitest";

// These integration tests render the full app and exercise multi-step async
// flows (submit -> navigate -> refetch -> render). Under parallel CPU load the
// default 1000ms async timeout is too tight, so allow more headroom.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  localStorage.clear();
});
