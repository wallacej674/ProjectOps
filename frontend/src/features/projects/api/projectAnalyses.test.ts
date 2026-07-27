import { getLatestProjectAnalysis, listProjectAnalyses, runProjectAnalysis } from "./projectAnalyses";

const analysis = {
  id: 12,
  project_id: 7,
  repo_integration_id: 3,
  status: "completed",
  summary: "This repository appears to include a Python backend.",
  detected_stack: { languages: ["python"], frameworks: ["fastapi"], tools: ["docker"] },
  detected_files: ["README.md", "backend/app/main.py"],
  detected_folders: ["backend", "backend/app"],
  signals: { has_readme: true, has_backend: true },
  warnings: [],
  error_message: null,
  total_files_scanned: 2,
  created_at: "2026-01-01T00:00:00Z",
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project analysis API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs CodeMap Lite analysis for a Project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(analysis, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runProjectAnalysis("7")).resolves.toEqual(analysis);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/analyses/run",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("preserves the backend no-repository error when running analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Project 7 does not have an attached repo." }, 404)),
    );

    await expect(runProjectAnalysis("7")).rejects.toMatchObject({
      kind: "not-found",
      message: "Project 7 does not have an attached repo.",
    });
  });

  it("gets the latest CodeMap Lite analysis for a Project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(analysis));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLatestProjectAnalysis("7")).resolves.toEqual(analysis);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/analyses/latest",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("preserves the backend no-analysis state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Project 7 does not have a repo analysis yet." }, 404)),
    );

    await expect(getLatestProjectAnalysis("7")).rejects.toMatchObject({
      kind: "not-found",
      message: "Project 7 does not have a repo analysis yet.",
    });
  });

  it("lists CodeMap Lite analysis history for a Project", async () => {
    const olderAnalysis = { ...analysis, id: 11, created_at: "2025-12-31T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([analysis, olderAnalysis])));

    await expect(listProjectAnalyses("7")).resolves.toEqual([analysis, olderAnalysis]);
  });

  it("preserves backend errors when analysis history cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Analysis service unavailable." }, 500)));

    await expect(listProjectAnalyses("7")).rejects.toMatchObject({
      kind: "unknown",
      message: "Analysis service unavailable.",
    });
  });
});
