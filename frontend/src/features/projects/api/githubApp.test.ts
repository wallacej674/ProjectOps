import { afterEach, describe, expect, it, vi } from "vitest";
import { attachGitHubAppRepository, completeGitHubAppAuthorization, getGitHubAppAuthorization } from "./githubApp";
import { json, mockFetch } from "../../../test/mockApi";

describe("GitHub App API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads a project-scoped signed authorization URL", async () => {
    mockFetch((url) => {
      expect(url).toBe("http://127.0.0.1:8000/api/v1/projects/7/github-app/authorize");
      return json({ enabled: true, authorize_url: "https://github.com/apps/projectops/installations/new?state=signed" });
    });
    await expect(getGitHubAppAuthorization("7")).resolves.toMatchObject({ enabled: true });
  });

  it("submits callback values through the authenticated API", async () => {
    mockFetch((url, init) => {
      expect(url).toBe("http://127.0.0.1:8000/api/v1/projects/github-app/callback");
      expect(JSON.parse(String(init.body))).toEqual({ code: "code", state: "state" });
      return json({ project_id: 7, installation_count: 1 });
    });
    await expect(completeGitHubAppAuthorization("code", "state")).resolves.toEqual({ project_id: 7, installation_count: 1 });
  });

  it("attaches only the selected installation and repository identifiers", async () => {
    mockFetch((url, init) => {
      expect(url).toContain("/api/v1/projects/7/github-app/repo");
      expect(JSON.parse(String(init.body))).toEqual({ installation_id: 91, repository_id: 22 });
      return json({ id: 1 });
    });
    await attachGitHubAppRepository("7", 91, 22);
  });
});
