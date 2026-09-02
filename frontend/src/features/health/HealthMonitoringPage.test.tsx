import { render, screen, within } from "@testing-library/react";
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
    expect(within(page).getByText("CivicPermit API")).toBeInTheDocument();
    expect(within(page).getByText("HTTP 200")).toBeInTheDocument();
    expect(within(page).getByText("184ms")).toBeInTheDocument();
    expect(within(page).getByText("jobs we will get")).toBeInTheDocument();
    expect(within(page).getByText("No production URL configured")).toBeInTheDocument();
    expect(within(page).getByRole("link", { name: /CivicPermit API/ })).toHaveAttribute(
      "href",
      "/app/projects/7#health",
    );
  });

  it("shows an empty state with no projects", async () => {
    mockHealthMonitoring(json([]));
    goHealthMonitoring();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(within(page).getByText(/No projects/i)).toBeInTheDocument();
  });
});
