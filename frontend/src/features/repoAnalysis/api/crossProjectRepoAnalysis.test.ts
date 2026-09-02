import { listCrossProjectRepoAnalysis } from "./crossProjectRepoAnalysis";

const overview = {
  project_id: 7,
  project_name: "CivicPermit API",
  project_status: "development",
  repo_owner: "openai",
  repo_name: "codex",
  latest_status: "completed",
  summary: "Python backend with a React frontend.",
  total_files_scanned: 214,
  analyzed_at: "2026-01-04T00:00:00Z",
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Cross-project repository analysis API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the latest analysis status per project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([overview]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCrossProjectRepoAnalysis()).resolves.toEqual([overview]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/repo-analyses",
      expect.any(Object),
    );
  });
});
