import { listCrossProjectReadiness } from "./crossProjectReadiness";

const overview = {
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
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Cross-project readiness API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the readiness score per project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([overview]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCrossProjectReadiness()).resolves.toEqual([overview]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/readiness",
      expect.any(Object),
    );
  });
});
