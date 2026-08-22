import {
  getReadinessEvidenceCoverage,
  linkReadinessArtifact,
  listReadinessItemArtifacts,
  unlinkReadinessArtifact,
} from "./projectReadinessArtifacts";

const evidence = {
  id: 5,
  project_id: 7,
  readiness_item_id: 9,
  item_key: "deployment_docs_reviewed",
  artifact: {
    id: 12,
    project_id: 7,
    created_by_user_id: 3,
    created_by_user: {
      id: 3,
      email: "reviewer@example.com",
      display_name: "Release Reviewer",
    },
    title: "Deployment runbook",
    artifact_type: "runbook",
    source_type: "external_url",
    url: "https://docs.example.com/runbook",
    content: null,
    summary: "Deployment steps.",
    tags: "deployment,runbook",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  created_at: "2026-01-03T00:00:00Z",
};

const coverage = {
  active_artifacts: 2,
  linked_active_artifacts: 1,
  unlinked_active_artifacts: 1,
  readiness_items_with_linked_artifacts: 1,
  readiness_items_without_linked_artifacts: 8,
  total_evidence_links: 1,
  artifact_usage: [
    {
      artifact: evidence.artifact,
      linked_item_count: 1,
      readiness_items: [
        {
          readiness_item_id: 9,
          item_key: "deployment_docs_reviewed",
          label: "Deployment Docs Reviewed",
          status: "unknown",
        },
      ],
    },
  ],
  readiness_items: [
    {
      readiness_item_id: 9,
      item_key: "deployment_docs_reviewed",
      label: "Deployment Docs Reviewed",
      status: "unknown",
      linked_artifact_count: 1,
      artifacts: [evidence.artifact],
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project readiness artifact evidence API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists linked artifacts for a readiness item", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([evidence]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listReadinessItemArtifacts("7", "deployment_docs_reviewed")).resolves.toEqual([evidence]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/readiness/items/deployment_docs_reviewed/artifacts",
      expect.any(Object),
    );
  });

  it("gets project-level readiness evidence coverage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(coverage));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getReadinessEvidenceCoverage("7")).resolves.toEqual(coverage);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/readiness/evidence-coverage",
      expect.any(Object),
    );
  });

  it("links an artifact to a readiness item", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(evidence, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(linkReadinessArtifact("7", "deployment_docs_reviewed", 12)).resolves.toEqual(evidence);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/readiness/items/deployment_docs_reviewed/artifacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ artifact_id: 12 }),
      }),
    );
  });

  it("unlinks an artifact from a readiness item", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(undefined, 204));
    vi.stubGlobal("fetch", fetchMock);

    await expect(unlinkReadinessArtifact("7", "deployment_docs_reviewed", 12)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/readiness/items/deployment_docs_reviewed/artifacts/12",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces duplicate link backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Artifact is already linked to this readiness item." }, 409)),
    );

    await expect(linkReadinessArtifact("7", "deployment_docs_reviewed", 12)).rejects.toMatchObject({
      message: "Artifact is already linked to this readiness item.",
    });
  });
});
