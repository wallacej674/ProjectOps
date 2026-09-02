import { listCrossProjectArtifactsOverview } from "./crossProjectArtifacts";

const overview = {
  project_id: 7,
  project_name: "CivicPermit API",
  project_status: "development",
  active_artifact_count: 3,
  most_recent_title: "Deployment runbook",
  most_recent_updated_at: "2026-01-04T00:00:00Z",
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Cross-project artifacts overview API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the artifact count and most recent title per project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([overview]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCrossProjectArtifactsOverview()).resolves.toEqual([overview]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/artifacts-overview",
      expect.any(Object),
    );
  });
});
