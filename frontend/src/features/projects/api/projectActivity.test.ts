import { listActivity, listProjectActivity } from "./projectActivity";

const activityEvent = {
  id: 21,
  project_id: 7,
  event_type: "artifact_created",
  event_category: "artifact",
  message: "Artifact was created.",
  related_resource_type: "project_artifact",
  related_resource_id: 12,
  metadata: { title: "Deployment runbook" },
  created_at: "2026-01-03T00:00:00Z",
};

const crossProjectActivityEvent = {
  ...activityEvent,
  project_name: "CivicPermit API",
  project_status: "development",
};

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project activity API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists activity events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([activityEvent]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectActivity("7")).resolves.toEqual([activityEvent]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/activity",
      expect.any(Object),
    );
  });

  it("lists an empty activity timeline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([])));

    await expect(listProjectActivity("7")).resolves.toEqual([]);
  });

  it("sends category, event type, limit, and offset filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([activityEvent]));
    vi.stubGlobal("fetch", fetchMock);

    await listProjectActivity("7", {
      category: "artifact",
      eventType: "artifact_created",
      limit: 10,
      offset: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/activity?category=artifact&event_type=artifact_created&limit=10&offset=20",
      expect.any(Object),
    );
  });

  it("preserves backend errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Activity service unavailable." }, 500)));

    await expect(listProjectActivity("7")).rejects.toMatchObject({
      kind: "unknown",
      message: "Activity service unavailable.",
    });
  });

  it("lists cross-project activity events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([crossProjectActivityEvent]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listActivity()).resolves.toEqual([crossProjectActivityEvent]);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/v1/activity", expect.any(Object));
  });

  it("lists an empty cross-project activity feed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([])));

    await expect(listActivity()).resolves.toEqual([]);
  });

  it("sends cross-project category, event type, project, limit, and offset filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([crossProjectActivityEvent]));
    vi.stubGlobal("fetch", fetchMock);

    await listActivity({
      category: "artifact",
      eventType: "artifact_created",
      projectId: 7,
      limit: 10,
      offset: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/activity?category=artifact&event_type=artifact_created&project_id=7&limit=10&offset=20",
      expect.any(Object),
    );
  });

  it("preserves cross-project activity backend errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Activity service unavailable." }, 500)));

    await expect(listActivity()).rejects.toMatchObject({
      kind: "unknown",
      message: "Activity service unavailable.",
    });
  });
});
