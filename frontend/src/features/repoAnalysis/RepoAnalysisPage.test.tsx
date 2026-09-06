import { render, screen, within, fireEvent } from "@testing-library/react";
import { App } from "../../app/App";
import { json, mockFetch } from "../../test/mockApi";

const overviews = [
  {
    project_id: 7,
    project_name: "CivicPermit API",
    project_status: "development",
    repo_owner: "openai",
    repo_name: "codex",
    detected_stack: { languages: ["Python"] },
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

const analysis = { id: 1, project_id: 7, repo_integration_id: 1, status: "completed", summary: "Python backend with a React frontend.", total_files_scanned: 214, created_at: "2026-01-04T00:00:00Z", detected_stack: { languages: ["Python"] }, signals: { has_tests: true, has_docker: false }, warnings: ["Lockfile missing"], detected_files: ["backend/pyproject.toml"], detected_folders: ["backend"], inspected_files: ["backend/pyproject.toml"], evidence_files: { python: ["backend/pyproject.toml"] } };

function goRepoAnalysis() {
  window.history.pushState({}, "", "/app/repository-analysis");
}

function mockRepoAnalysis(response = json(overviews)) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/repo-analyses") && method === "GET") return response;
    if (url.endsWith("/analyses/latest")) return json(analysis);
    if (url.endsWith("/analyses")) return json([analysis]);
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
    expect(await within(page).findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    expect(within(page).getAllByText("openai/codex")[0]).toBeInTheDocument();
    expect(await within(page).findByText("214 files")).toBeInTheDocument();
    expect(within(page).getByText("jobs we will get")).toBeInTheDocument();
    expect(within(page).getByText("No repository connected")).toBeInTheDocument();
    expect(within(page).getByRole("link", { name: "Explore analysis for CivicPermit API" })).toHaveAttribute("href", "/app/repository-analysis?project=7");
    expect(screen.queryByRole("navigation", { name: "Analysis sections" })).not.toBeInTheDocument();
  });

  it("shows an empty state with no projects", async () => {
    mockRepoAnalysis(json([]));
    goRepoAnalysis();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Repository Analysis" });
    expect(await within(page).findByText(/No projects/i)).toBeInTheDocument();
  });
});

it("opens stack, evidence and history while keeping unselected history requests idle", async () => {
  const fetchMock = mockRepoAnalysis();
  goRepoAnalysis(); render(<App />);
  await screen.findByText("214 files");
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/analyses"))).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: "Explore analysis for CivicPermit API" }));
  await screen.findByRole("navigation", { name: "Analysis sections" });
  fireEvent.click(screen.getByRole("button", { name: "Stack & signals" }));
  expect(await screen.findByText("Python")).toBeInTheDocument();
  expect(screen.getByText("Not detected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
  expect(await screen.findByRole("region", { name: "Analysis evidence" })).toHaveTextContent("backend/pyproject.toml");
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  expect(await screen.findByRole("region", { name: "Analysis history" })).toBeInTheDocument();
  expect(await screen.findByText("Lockfile missing")).toBeInTheDocument();
});

it("opens a full-width report and returns to the gallery with filters preserved", async () => {
  mockRepoAnalysis(); goRepoAnalysis(); render(<App />);
  await screen.findByText("214 files");
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a repository" }), { target: { value: "Civic" } });
  fireEvent.click(screen.getByRole("link", { name: "Explore analysis for CivicPermit API" }));
  expect(await screen.findByRole("region", { name: "CivicPermit API" })).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Project repository analysis status" })).not.toBeInTheDocument();
  expect(window.location.search).toBe("?project=7");
  fireEvent.click(screen.getByRole("button", { name: "← All repositories" }));
  expect(await screen.findByRole("searchbox", { name: "Find a repository" })).toHaveValue("Civic");
  expect(screen.queryByText("jobs we will get")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a repository" }), { target: { value: "missing" } });
  expect(screen.getByText("No repositories match your filters.")).toBeInTheDocument();
});

it("keeps overview information when detailed analysis fails", async () => {
  mockFetch(url => url.endsWith("/repo-analyses") ? json(overviews) : json({detail: "Scan service unavailable"}, 500));
  goRepoAnalysis(); render(<App />);
  fireEvent.click(await screen.findByRole("link", { name: "Explore analysis for CivicPermit API" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Scan service unavailable");
  expect(screen.getByText("Python backend with a React frontend.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
  expect(screen.getByText("Analysis details unavailable.")).toBeInTheDocument();
});


