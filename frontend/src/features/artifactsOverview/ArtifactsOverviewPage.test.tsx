import { render, screen, within } from "@testing-library/react";
import { App } from "../../app/App";
import { json, mockFetch } from "../../test/mockApi";

const overviews = [
  {
    project_id: 7,
    project_name: "CivicPermit API",
    project_status: "development",
    active_artifact_count: 3,
    most_recent_title: "Deployment runbook",
    most_recent_updated_at: "2026-01-04T00:00:00Z",
  },
  {
    project_id: 9,
    project_name: "jobs we will get",
    project_status: "development",
    active_artifact_count: 0,
    most_recent_title: null,
    most_recent_updated_at: null,
  },
];

function goArtifactsOverview() {
  window.history.pushState({}, "", "/app/artifacts");
}

function mockArtifactsOverview(response = json(overviews)) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/artifacts-overview") && method === "GET") return response;
    return json([]);
  });
}

describe("Cross-project Artifacts page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the artifact count and most recent title for each project", async () => {
    mockArtifactsOverview();
    goArtifactsOverview();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Artifacts" });
    expect(within(page).getByText("CivicPermit API")).toBeInTheDocument();
    expect(within(page).getByText("Deployment runbook")).toBeInTheDocument();
    expect(within(page).getByText("3 active")).toBeInTheDocument();
    expect(within(page).getByText("jobs we will get")).toBeInTheDocument();
    expect(within(page).getByText("No artifacts yet")).toBeInTheDocument();
    expect(within(page).getByRole("link", { name: /CivicPermit API/ })).toHaveAttribute(
      "href",
      "/app/projects/7#artifacts",
    );
  });

  it("shows an empty state with no projects", async () => {
    mockArtifactsOverview(json([]));
    goArtifactsOverview();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Artifacts" });
    expect(within(page).getByText(/No projects/i)).toBeInTheDocument();
  });
});
