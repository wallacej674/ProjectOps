import {
  archiveProjectArtifact,
  createProjectArtifact,
  getProjectArtifact,
  listProjectArtifacts,
  updateProjectArtifact,
} from "./projectArtifacts";

const artifact = {
  id: 12,
  project_id: 7,
  title: "Deployment runbook",
  artifact_type: "runbook",
  source_type: "external_url",
  url: "https://docs.example.com/runbook",
  content: "Use the release checklist.",
  summary: "Production deployment steps.",
  tags: "deployment,runbook",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project artifacts API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates an artifact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(artifact, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createProjectArtifact("7", {
        title: "Deployment runbook",
        artifact_type: "runbook",
        source_type: "external_url",
        url: "https://docs.example.com/runbook",
        summary: "Production deployment steps.",
        content: "Use the release checklist.",
        tags: "deployment,runbook",
      }),
    ).resolves.toEqual(artifact);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/artifacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Deployment runbook",
          artifact_type: "runbook",
          source_type: "external_url",
          url: "https://docs.example.com/runbook",
          summary: "Production deployment steps.",
          content: "Use the release checklist.",
          tags: "deployment,runbook",
        }),
      }),
    );
  });

  it("lists artifacts with filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([artifact]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listProjectArtifacts("7", {
        includeArchived: true,
        artifactType: "runbook",
        sourceType: "external_url",
        search: "deployment",
        tags: ["runbook", "release"],
      }),
    ).resolves.toEqual([artifact]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/artifacts?include_archived=true&artifact_type=runbook&source_type=external_url&search=deployment&tags=runbook%2Crelease",
      expect.any(Object),
    );
  });

  it("preserves list backend errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Artifact service unavailable." }, 500)));

    await expect(listProjectArtifacts("7")).rejects.toMatchObject({
      kind: "unknown",
      message: "Artifact service unavailable.",
    });
  });

  it("gets one artifact", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(artifact)));

    await expect(getProjectArtifact("7", "12")).resolves.toEqual(artifact);
  });

  it("updates an artifact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ...artifact, title: "Updated runbook" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateProjectArtifact("7", "12", { title: "Updated runbook" })).resolves.toMatchObject({
      title: "Updated runbook",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/artifacts/12",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Updated runbook" }),
      }),
    );
  });

  it("preserves validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: [{ msg: "Artifact title is required." }] }, 422)));

    await expect(createProjectArtifact("7", { title: "", artifact_type: "note", source_type: "manual" })).rejects.toMatchObject({
      kind: "validation",
      message: "Artifact title is required.",
    });
  });

  it("archives an artifact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ...artifact, status: "archived" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(archiveProjectArtifact("7", "12")).resolves.toMatchObject({ status: "archived" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/artifacts/12",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
