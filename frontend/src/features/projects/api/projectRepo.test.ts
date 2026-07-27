import { attachProjectRepo, getProjectRepo, removeProjectRepo } from "./projectRepo";

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

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Project repo API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gets the attached repository connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(repo)));

    await expect(getProjectRepo("7")).resolves.toEqual(repo);
  });

  it("preserves the backend no-repository state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Project 7 does not have an attached repo." }, 404)));

    await expect(getProjectRepo("7")).rejects.toMatchObject({
      kind: "not-found",
      message: "Project 7 does not have an attached repo.",
    });
  });

  it("attaches a repository connection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(repo, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(attachProjectRepo("7", { repo_url: "https://github.com/openai/codex.git" })).resolves.toEqual(repo);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/repo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ repo_url: "https://github.com/openai/codex.git" }),
      }),
    );
  });

  it("preserves backend invalid-url validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Enter a valid GitHub repository URL." }, 422)));

    await expect(attachProjectRepo("7", { repo_url: "https://gitlab.com/openai/codex" })).rejects.toMatchObject({
      kind: "validation",
      message: "Enter a valid GitHub repository URL.",
    });
  });

  it("removes a repository connection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(removeProjectRepo("7")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/projects/7/repo",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
