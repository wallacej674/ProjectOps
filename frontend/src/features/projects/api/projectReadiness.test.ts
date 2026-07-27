import { evaluateProjectReadiness, getProjectReadiness, updateProjectReadinessItem } from "./projectReadiness";

const readinessSummary = {
  score: 22,
  status: "needs_work",
  passed: 2,
  failed: 3,
  unknown: 4,
  not_applicable: 0,
  total_applicable: 9,
  top_gaps: ["README Present"],
  items: [],
};

const manualItem = {
  id: 31,
  project_id: 7,
  readiness_item_id: 9,
  item: {
    id: 9,
    key: "secrets_management_reviewed",
    label: "Secrets Management Reviewed",
    description: "An engineer has reviewed how secrets and credentials are managed.",
    category: "engineering_review",
    evaluation_type: "manual",
    sort_order: 90,
    is_active: true,
  },
  status: "passed",
  source: "manual",
  evidence: null,
  notes: "Reviewed by engineering.",
  evaluated_at: "2026-01-01T00:00:00Z",
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project readiness API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("evaluates readiness for a Project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(readinessSummary, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(evaluateProjectReadiness("7")).resolves.toEqual(readinessSummary);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/readiness/evaluate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("preserves backend errors when readiness evaluation fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Project 7 was not found." }, 404)));

    await expect(evaluateProjectReadiness("7")).rejects.toMatchObject({
      kind: "not-found",
      message: "Project 7 was not found.",
    });
  });

  it("gets the latest readiness summary for a Project", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(readinessSummary)));

    await expect(getProjectReadiness("7")).resolves.toEqual(readinessSummary);
  });

  it("preserves the backend not-started readiness state", async () => {
    const notStarted = {
      ...readinessSummary,
      score: null,
      status: "not_started",
      passed: 0,
      failed: 0,
      unknown: 0,
      not_applicable: 0,
      total_applicable: 0,
      top_gaps: [],
      items: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(notStarted)));

    await expect(getProjectReadiness("7")).resolves.toEqual(notStarted);
  });

  it("updates a manual readiness item", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(manualItem));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateProjectReadinessItem("7", "secrets_management_reviewed", {
        status: "passed",
        notes: "Reviewed by engineering.",
      }),
    ).resolves.toEqual(manualItem);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/readiness/items/secrets_management_reviewed",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "passed", notes: "Reviewed by engineering." }),
      }),
    );
  });

  it("preserves backend validation errors for manual item updates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: [{ msg: "Input should be 'passed'." }] }, 422)));

    await expect(
      updateProjectReadinessItem("7", "secrets_management_reviewed", {
        status: "passed",
        notes: null,
      }),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Input should be 'passed'.",
    });
  });

  it("preserves automatic item rejection errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Readiness item 'readme_present' is automatic and cannot be updated manually." }, 400)),
    );

    await expect(
      updateProjectReadinessItem("7", "readme_present", {
        status: "passed",
      }),
    ).rejects.toMatchObject({
      kind: "unknown",
      message: "Readiness item 'readme_present' is automatic and cannot be updated manually.",
    });
  });
});
