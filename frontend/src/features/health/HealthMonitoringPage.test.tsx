import { render, screen, within, fireEvent } from "@testing-library/react";
import { App } from "../../app/App";
import { json, mockFetch } from "../../test/mockApi";

const summaries = [
  {
    project_id: 7,
    project_name: "CivicPermit API",
    project_status: "development",
    production_url: "https://civicpermit.example.com",
    latest_check: {
      id: 21,
      project_id: 7,
      target_url: "https://civicpermit.example.com",
      status: "healthy",
      execution_source: "manual",
      http_status_code: 200,
      response_time_ms: 184,
      checked_at: "2026-01-04T00:00:00Z",
      error_message: null,
      response_preview: "ok",
      created_at: "2026-01-04T00:00:01Z",
    },
  },
  {
    project_id: 9,
    project_name: "jobs we will get",
    project_status: "development",
    production_url: null,
    latest_check: null,
  },
];

function goHealthMonitoring() {
  window.history.pushState({}, "", "/app/health");
}

function mockHealthMonitoring(response = json(summaries)) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/health-checks") && method === "GET") return response;
    if (url.includes("/health-alerts")) return json({ items: [], total: 0 });
    return json([]);
  });
}

describe("Cross-project Health Monitoring page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the latest health check for each project", async () => {
    mockHealthMonitoring();
    goHealthMonitoring();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(await within(page).findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    expect(within(page).getByText("HTTP 200")).toBeInTheDocument();
    expect(within(page).getByText("184ms")).toBeInTheDocument();
    expect(within(page).getByText("jobs we will get")).toBeInTheDocument();
    expect(within(page).getByText("No production URL configured")).toBeInTheDocument();
    expect(within(page).getByRole("link", { name: "Manage monitoring" })).toHaveAttribute(
      "href",
      "/app/projects/7?view=monitoring",
    );
  });

  it("shows an empty state with no projects", async () => {
    mockHealthMonitoring(json([]));
    goHealthMonitoring();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(await within(page).findByText(/No projects/i)).toBeInTheDocument();
  });
});

it("shows acknowledged active alerts and overdue monitoring as separate signals", async () => {
  const alertRow = { ...summaries[0], monitor: { enabled: false, active_alert: { acknowledged_at: "2026-09-01T00:00:00Z" }, freshness: "disabled", consecutive_healthy: 0 } };
  const overdueRow = { ...summaries[1], monitor: { enabled: true, active_alert: null, freshness: "overdue" } };
  mockHealthMonitoring(json([alertRow, overdueRow]));
  goHealthMonitoring();
  render(<App />);
  expect(await screen.findByText(/Active alert: scheduled checks are failing/)).toBeInTheDocument();
  expect(screen.getByText(/Monitoring paused; recovery unconfirmed/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Show health" }), { target: { value: "overdue" } });
  expect(screen.queryByRole("link", { name: "CivicPermit API" })).not.toBeInTheDocument();
  expect(await screen.findByText(/Monitoring overdue. Endpoint health is unconfirmed/)).toBeInTheDocument();
});

it("does not attribute a successful alternative URL check to production", async () => {
  mockHealthMonitoring(json([{ ...summaries[0], latest_check: { ...summaries[0].latest_check, target_url: "https://alternative.example.com" } }]));
  goHealthMonitoring();
  render(<App />);
  expect(await screen.findByText("Production target: Not checked yet")).toBeInTheDocument();
});

it("selects projects in place, preserves the URL, and clears details when search has no results", async () => {
  mockHealthMonitoring();
  goHealthMonitoring();
  render(<App />);
  const selector = await screen.findByRole("complementary", { name: "Project selector" });
  const second = await within(selector).findByRole("button", { name: /jobs we will get/ });
  fireEvent.click(second);
  expect(await screen.findByRole("heading", { name: "jobs we will get" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "CivicPermit API" })).not.toBeInTheDocument();
  expect(window.location.search).toBe("?project=9");
  expect(second).toHaveAttribute("aria-current", "true");
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a project" }), { target: { value: "absent project" } });
  expect(screen.getByText("No Projects match this filter.")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Manage monitoring" })).not.toBeInTheDocument();
});

it("loads only the selected project's history and exposes response evidence on demand", async () => {
  const fetchMock = mockFetch((url) => {
    if (url.endsWith("/api/v1/health-checks")) return json(summaries);
    if (url.endsWith("/projects/7/health-checks")) return json([summaries[0].latest_check]);
    if (url.includes("/health-alerts")) return json({items: [], total: 0});
    return json([]);
  });
  goHealthMonitoring();
  render(<App />);
  const history = await screen.findByRole("region", { name: "Check history" });
  const evidence = await within(history).findByText("ok");
  expect(evidence).not.toBeVisible();
  fireEvent.click(within(history).getByText("healthy"));
  expect(evidence).toBeVisible();
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/projects/9/health-checks"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /jobs we will get/ }));
  expect(await screen.findByText("No check history yet.")).toBeInTheDocument();
  expect(screen.queryByText("ok")).not.toBeInTheDocument();
});
