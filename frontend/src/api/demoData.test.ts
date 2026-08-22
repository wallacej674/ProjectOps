import { afterEach, describe, expect, it, vi } from "vitest";
import { demoDataApi } from "./demoData";
import { json, makeProject, mockFetch } from "../test/mockApi";

describe("demo data API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads demo data status", async () => {
    mockFetch((url) => {
      expect(url).toBe("http://127.0.0.1:8000/api/v1/demo-data/status");
      return json({ enabled: true, reason: null });
    });

    await expect(demoDataApi.status()).resolves.toEqual({ enabled: true, reason: null });
  });

  it("seeds demo data", async () => {
    const project = makeProject({ id: 99, name: "ProjectOps Demo Command Center" });
    mockFetch((url, init) => {
      expect(url).toBe("http://127.0.0.1:8000/api/v1/demo-data/seed");
      expect(init.method).toBe("POST");
      return json({ created: true, project, message: "Demo workspace was created." }, 201);
    });

    await expect(demoDataApi.seed()).resolves.toEqual({
      created: true,
      project,
      message: "Demo workspace was created.",
    });
  });
});
