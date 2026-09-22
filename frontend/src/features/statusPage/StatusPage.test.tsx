import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi, test, expect, afterEach } from "vitest";
import { StatusPage } from "./StatusPage";

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/status/${slug}`]}>
      <Routes>
        <Route path="/status/:slug" element={<StatusPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("shows current status, incident banner, and history for a published page", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        label: "LaunchBudget",
        target_url: "https://launchbudget.example.com",
        current_status: "unhealthy",
        last_checked_at: "2026-09-22T00:00:00Z",
        active_incident: { opened_at: "2026-09-21T23:00:00Z", last_observed_at: "2026-09-22T00:00:00Z", recovered_at: null },
        history: [
          { status: "unhealthy", http_status_code: 500, response_time_ms: 120, checked_at: "2026-09-22T00:00:00Z" },
          { status: "healthy", http_status_code: 200, response_time_ms: 80, checked_at: "2026-09-21T23:00:00Z" },
        ],
        generated_at: "2026-09-22T00:05:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );

  renderAt("abc123");

  expect(await screen.findByText("LaunchBudget")).toBeInTheDocument();
  expect(screen.getByText("https://launchbudget.example.com")).toBeInTheDocument();
  expect(screen.getByText("Investigating an active issue")).toBeInTheDocument();
  expect(screen.getAllByText("Unhealthy").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/HTTP 500|HTTP 200/)).toHaveLength(2);
});

test("shows an unavailable message for a missing or unpublished slug", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ detail: "No public status page is published at this link." }), { status: 404 }),
  );

  renderAt("does-not-exist");

  expect(await screen.findByText("Status page unavailable")).toBeInTheDocument();
  expect(screen.getByText("This status page does not exist, or is no longer published.")).toBeInTheDocument();
});

test("shows a neutral state when no checks have run yet", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        label: "LaunchBudget", target_url: "https://launchbudget.example.com", current_status: null,
        last_checked_at: null, active_incident: null, history: [], generated_at: "2026-09-22T00:05:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );

  renderAt("abc123");

  expect(await screen.findByText("No checks recorded yet")).toBeInTheDocument();
  expect(screen.getByText("No observations recorded yet.")).toBeInTheDocument();
});
