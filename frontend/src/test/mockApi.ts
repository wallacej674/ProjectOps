import { vi } from "vitest";
import type { Project } from "../types/project";

/** Build a Project with sensible defaults; override any field per test. */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 7,
    name: "CivicPermit API",
    description: "Permit workflow service",
    repo_url: null,
    production_url: null,
    status: "development",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

/** A JSON Response, mirroring how the FastAPI backend replies. */
export const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** A FastAPI-style validation error (422) with a `detail` list. */
export const validationError = (message: string) =>
  json({ detail: [{ msg: message }] }, 422);

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/**
 * Replace global fetch with a deterministic handler keyed off (url, init).
 * Tests must never reach the real backend.
 */
export function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/**
 * Convenience router for the Project endpoints. Pass handlers per concern;
 * unspecified concerns return an empty list / 404 as appropriate.
 */
export function mockProjectsApi(opts: {
  list?: Project[];
  get?: Project | "not-found";
  create?: Project | Response;
  update?: Project | Response;
  archive?: Project | Response;
} = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.includes("/api/v1/projects") && !url.match(/projects\/[^?]/) && method === "GET") {
      return json(opts.list ?? []);
    }
    if (method === "POST") {
      return opts.create instanceof Response ? opts.create : json(opts.create ?? makeProject(), 201);
    }
    if (method === "PATCH") {
      return opts.update instanceof Response ? opts.update : json(opts.update ?? makeProject());
    }
    if (method === "DELETE") {
      return opts.archive instanceof Response
        ? opts.archive
        : json(opts.archive ?? makeProject({ status: "archived" }));
    }
    // GET single project
    if (opts.get === "not-found") return json({ detail: "Project was not found." }, 404);
    return json(opts.get ?? makeProject());
  });
}
