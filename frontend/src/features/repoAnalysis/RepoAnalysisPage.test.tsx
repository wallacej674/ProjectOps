import { render, screen, within } from "@testing-library/react";
import { App } from "../../app/App";
import { json, mockFetch } from "../../test/mockApi";

const overviews = [
  {
    project_id: 7,
    project_name: "CivicPermit API",
    project_status: "development",
    repo_owner: "openai",
    repo_name: "codex",
    latest_status: "completed",
    summary: "Python backend with a React frontend.",
    total_files_scanned: 214,
    analyzed_at: "2026-01-04T00:00:00Z",
  },
  {
    project_id: 9,
    project_name: "jobs we will get",
    project_status: "development",
    repo_owner: null,
    repo_name: null,
    latest_status: null,
    summary: null,
    total_files_scanned: null,
    analyzed_at: null,
  },
];

function goRepoAnalysis() {
  window.history.pushState({}, "", "/app/repository-analysis");
}

function mockRepoAnalysis(response = json(overviews)) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/repo-analyses") && method === "GET") return response;
    return json([]);
  });
}

describe("Cross-project Repository Analysis page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the latest analysis status for each project", async () => {
    mockRepoAnalysis();
    goRepoAnalysis();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Repository Analysis" });
    expect(within(page).getByText("CivicPermit API")).toBeInTheDocument();
    expect(within(page).getByText("openai/codex")).toBeInTheDocument();
    expect(within(page).getByText("214 files")).toBeInTheDocument();
    expect(within(page).getByText("jobs we will get")).toBeInTheDocument();
    expect(within(page).getByText("No repository connected")).toBeInTheDocument();
    expect(within(page).getByRole("link", { name: /CivicPermit API/ })).toHaveAttribute(
      "href",
      "/app/projects/7#codemap",
    );
  });

  it("shows an empty state with no projects", async () => {
    mockRepoAnalysis(json([]));
    goRepoAnalysis();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Repository Analysis" });
    expect(within(page).getByText(/No projects/i)).toBeInTheDocument();
  });
});
