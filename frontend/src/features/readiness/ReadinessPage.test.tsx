import { render, screen, within } from "@testing-library/react";
import { App } from "../../app/App";
import { json, mockFetch } from "../../test/mockApi";

const overviews = [
  {
    project_id: 7,
    project_name: "CivicPermit API",
    project_status: "development",
    score: 66,
    status: "in_progress",
    passed: 6,
    failed: 0,
    unknown: 3,
    not_applicable: 0,
    total_applicable: 9,
    top_gaps: ["Deployment Docs Reviewed"],
  },
  {
    project_id: 9,
    project_name: "jobs we will get",
    project_status: "development",
    score: null,
    status: "not_started",
    passed: 0,
    failed: 0,
    unknown: 0,
    not_applicable: 0,
    total_applicable: 0,
    top_gaps: [],
  },
];

function goReadiness() {
  window.history.pushState({}, "", "/app/readiness");
}

function mockReadiness(response = json(overviews)) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/readiness") && method === "GET") return response;
    return json([]);
  });
}

describe("Cross-project Readiness page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the readiness score for each project", async () => {
    mockReadiness();
    goReadiness();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Readiness" });
    expect(within(page).getByText("CivicPermit API")).toBeInTheDocument();
    expect(within(page).getByText("66/100")).toBeInTheDocument();
    expect(within(page).getByText("Deployment Docs Reviewed")).toBeInTheDocument();
    expect(within(page).getByText("jobs we will get")).toBeInTheDocument();
    expect(within(page).getByText("Not evaluated")).toBeInTheDocument();
    expect(within(page).getByRole("link", { name: /CivicPermit API/ })).toHaveAttribute(
      "href",
      "/app/projects/7#readiness",
    );
  });

  it("shows an empty state with no projects", async () => {
    mockReadiness(json([]));
    goReadiness();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Readiness" });
    expect(within(page).getByText(/No projects/i)).toBeInTheDocument();
  });
});
