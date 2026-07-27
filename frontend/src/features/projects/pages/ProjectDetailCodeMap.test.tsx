import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch } from "../../../test/mockApi";

const project = makeProject({
  id: 7,
  name: "CivicPermit API",
  repo_url: "https://github.com/example/metadata-only",
});

const completedAnalysis = {
  id: 12,
  project_id: 7,
  repo_integration_id: 3,
  status: "completed",
  summary:
    "This repository appears to include a Python backend, a React/Vite frontend, tests, Docker support, GitHub Actions CI.",
  detected_stack: {
    languages: ["python", "typescript"],
    frameworks: ["fastapi", "react", "vite"],
    tools: ["docker", "github_actions"],
  },
  detected_files: ["README.md", "backend/app/main.py", "frontend/src/main.tsx"],
  detected_folders: ["backend", "backend/app", "frontend", "frontend/src"],
  signals: { has_readme: true, has_backend: true, has_frontend: true, has_tests: true, has_ci: true },
  warnings: ["No environment example detected."],
  error_message: null,
  total_files_scanned: 42,
  created_at: "2026-01-03T12:00:00Z",
};


const failedAnalysis = {
  ...completedAnalysis,
  id: 13,
  status: "failed",
  summary: "CodeMap Lite analysis failed.",
  detected_stack: { languages: [], frameworks: [], tools: [] },
  detected_files: [],
  detected_folders: [],
  signals: {},
  warnings: [],
  error_message: "GitHub repository tree response was truncated.",
  total_files_scanned: 0,
  created_at: "2026-01-04T12:00:00Z",
};
const repo = {
  id: 3,
  project_id: 7,
  provider: "github",
  repo_owner: "openai",
  repo_name: "codex",
  repo_url: "https://github.com/openai/codex",
  default_branch: null,
  is_connected: true,
  last_verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

function renderDetail() {
  window.history.pushState({}, "", "/app/projects/7");
  return render(<App />);
}

function responseClone(response: Response) {
  return response.clone();
}

function mockProjectDetail({
  repoResponse = json(repo),
  latestResponse = json({ detail: "Project 7 does not have a repo analysis yet." }, 404),
  historyResponse = json([]),
  runResponse = json(completedAnalysis, 201),
}: {
  repoResponse?: Response;
  latestResponse?: Response;
  historyResponse?: Response;
  runResponse?: Response | Promise<Response>;
} = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/projects/7") && method === "GET") return json(project);
    if (url.endsWith("/api/v1/projects/7/repo") && method === "GET") return responseClone(repoResponse);
    if (url.endsWith("/api/v1/projects/7/analyses/latest") && method === "GET") return responseClone(latestResponse);
    if (url.endsWith("/api/v1/projects/7/analyses") && method === "GET") return responseClone(historyResponse);
    if (url.endsWith("/api/v1/projects/7/analyses/run") && method === "POST") {
      return runResponse instanceof Promise ? runResponse : responseClone(runResponse);
    }
    return json([]);
  });
}

describe("Project detail CodeMap Lite analysis", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a no-repository state before CodeMap Lite can run", async () => {
    mockProjectDetail({
      repoResponse: json({ detail: "Project 7 does not have an attached repo." }, 404),
    });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect(within(section).getByText("Attach a GitHub repository before running analysis.")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Run Analysis" })).toBeDisabled();
    expect(within(section).getByText(/CodeMap Lite reads repository paths/)).toBeInTheDocument();
    expect(within(section).queryByText(/AI analyzed/)).not.toBeInTheDocument();
  });

  it("shows a connected repository state when no analysis exists yet", async () => {
    mockProjectDetail();

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect(within(section).getByText("openai/codex")).toBeInTheDocument();
    expect(within(section).getByText("No analysis has been run yet.")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Run Analysis" })).toBeEnabled();
    expect(within(section).getByText(/It does not clone the repository/)).toBeInTheDocument();
    expect(within(section).getByText(/It does not use AI/)).toBeInTheDocument();
    expect(within(section).getByText(/path-based signals only/)).toBeInTheDocument();
  });

  it("shows the latest completed analysis result after refresh", async () => {
    mockProjectDetail({ latestResponse: json(completedAnalysis), historyResponse: json([completedAnalysis]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect((await within(section).findAllByText(completedAnalysis.summary)).length).toBeGreaterThan(0);
    expect(within(section).getAllByText("completed").length).toBeGreaterThan(0);
    expect(within(section).getByText("42")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Run Again" })).toBeEnabled();
  });

  it("disables the run button while analysis is pending and then shows the result", async () => {
    let resolveRun: (response: Response) => void = () => undefined;
    const runResponse = new Promise<Response>((resolve) => {
      resolveRun = resolve;
    });
    mockProjectDetail({ runResponse });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    await user.click(await within(section).findByRole("button", { name: "Run Analysis" }));

    expect(within(section).getByRole("button", { name: "Running Analysis" })).toBeDisabled();
    expect(within(section).getByText("CodeMap Lite analysis is running...")).toBeInTheDocument();

    resolveRun(json(completedAnalysis, 201));

    expect((await within(section).findAllByText(completedAnalysis.summary)).length).toBeGreaterThan(0);
    const runAgainButton = within(section).getByRole("button", { name: "Run Again" });
    expect(runAgainButton).toBeEnabled();
    await waitFor(() => expect(runAgainButton).toHaveFocus());
    expect(await within(section).findByText("42 files scanned")).toBeInTheDocument();
    await waitFor(() => expect(within(section).queryByText("CodeMap Lite analysis is running...")).not.toBeInTheDocument());
  });

  it("shows a stored failed analysis clearly", async () => {
    mockProjectDetail({ latestResponse: json(failedAnalysis), historyResponse: json([failedAnalysis]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect((await within(section).findAllByText("failed")).length).toBeGreaterThan(0);
    expect(within(section).getByText("GitHub repository tree response was truncated.")).toBeInTheDocument();
    expect(within(section).getByText(/What likely happened/)).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Retry Analysis" })).toBeEnabled();
  });

  it("shows a backend error when run analysis cannot complete", async () => {
    mockProjectDetail({ runResponse: json({ detail: "Analysis service unavailable." }, 500) });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    await user.click(await within(section).findByRole("button", { name: "Run Analysis" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent("Analysis service unavailable.");
    expect(within(section).getByRole("button", { name: "Run Analysis" })).toBeEnabled();
  });
  it("renders detected stack, architecture signals, warnings, and evidence", async () => {
    mockProjectDetail({ latestResponse: json(completedAnalysis), historyResponse: json([completedAnalysis]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect(await within(section).findByRole("heading", { name: "Detected Stack" })).toBeInTheDocument();
    expect(within(section).getByText("python")).toBeInTheDocument();
    expect(within(section).getByText("typescript")).toBeInTheDocument();
    expect(within(section).getByText("fastapi")).toBeInTheDocument();
    expect(within(section).getByText("README present: detected")).toBeInTheDocument();
    expect(within(section).getByText("Backend detected: detected")).toBeInTheDocument();
    expect(within(section).getByText("No environment example detected.")).toBeInTheDocument();
    expect(within(section).getByText("backend/app/main.py")).toBeInTheDocument();
    expect(within(section).getByText("frontend/src")).toBeInTheDocument();
  });
  it("shows analysis history with the latest marker", async () => {
    const olderAnalysis = { ...completedAnalysis, id: 11, total_files_scanned: 18, created_at: "2026-01-02T12:00:00Z" };
    mockProjectDetail({ latestResponse: json(completedAnalysis), historyResponse: json([completedAnalysis, olderAnalysis]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect(await within(section).findByRole("heading", { name: "Analysis History" })).toBeInTheDocument();
    expect(await within(section).findByText("Latest attempt")).toBeInTheDocument();
    expect(await within(section).findByText("18 files scanned")).toBeInTheDocument();
  });

  it("shows an empty history state when no analysis has been stored", async () => {
    mockProjectDetail({ historyResponse: json([]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect(await within(section).findByRole("heading", { name: "Analysis History" })).toBeInTheDocument();
    expect(within(section).getByText("No analysis history yet.")).toBeInTheDocument();
  });
  it("keeps the CodeMap section stable when repository loading fails", async () => {
    mockProjectDetail({ repoResponse: json({ detail: "Repository service unavailable." }, 500) });

    renderDetail();

    expect(await screen.findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    const repoSection = screen.getByRole("region", { name: "Repository Connection" });
    expect(await within(repoSection).findByRole("alert")).toHaveTextContent("Repository service unavailable.");

    const codeMapSection = screen.getByRole("region", { name: "CodeMap Lite Analysis" });
    expect(within(codeMapSection).getByText("Attach a GitHub repository before running analysis.")).toBeInTheDocument();
  });

  it("shows analysis history loading errors without hiding the latest result", async () => {
    mockProjectDetail({
      latestResponse: json(completedAnalysis),
      historyResponse: json({ detail: "Analysis history unavailable." }, 500),
    });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect((await within(section).findAllByText(completedAnalysis.summary)).length).toBeGreaterThan(0);
    expect(await within(section).findByRole("alert")).toHaveTextContent("Analysis history unavailable.");
  });

  it("renders long evidence paths in readable monospace rows", async () => {
    const longPath = "frontend/src/features/projects/components/deeply/nested/codemap/evidence/RepositoryArchitectureSignalMatrix.tsx";
    const longFolder = "backend/app/services/repository_analysis/providers/github/tree/intake";
    const analysisWithLongPaths = {
      ...completedAnalysis,
      detected_files: [longPath],
      detected_folders: [longFolder],
    };
    mockProjectDetail({ latestResponse: json(analysisWithLongPaths), historyResponse: json([analysisWithLongPaths]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "CodeMap Lite Analysis" });
    expect(await within(section).findByText(longPath)).toHaveClass("mono");
    expect(within(section).getByText(longFolder)).toHaveClass("mono");
  });
});