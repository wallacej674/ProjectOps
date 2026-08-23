import { vi } from "vitest";
import type { Project } from "../types/project";
import { storeAuthSession } from "../api/authStorage";
import type { AuthUser } from "../api/authTypes";

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

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    email: "engineer@example.com",
    display_name: null,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function signInTestUser() {
  storeAuthSession("test-token", makeAuthUser());
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

function responseFrom(value: Response | unknown, status?: number) {
  return value instanceof Response ? value.clone() : json(value, status);
}

/**
 * Replace global fetch with a deterministic handler keyed off (url, init).
 * Tests must never reach the real backend.
 */
export function mockFetch(handler: Handler) {
  signInTestUser();
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
  list?: Project[] | Response;
  get?: Project | "not-found";
  create?: Project | Response;
  update?: Project | Response;
  archive?: Project | Response;
} = {}) {
  signInTestUser();
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.includes("/api/v1/demo-data/status") && method === "GET") {
      return json({ enabled: false, reason: "Demo data seeding is disabled in this test environment." });
    }
    if (url.includes("/api/v1/activity") && method === "GET") {
      return json([]);
    }
    if (url.includes("/api/v1/projects") && !url.match(/projects\/[^?]/) && method === "GET") {
      return responseFrom(opts.list ?? []);
    }
    if (url.includes("/activity") && method === "GET") return json([]);
    if (url.includes("/repo") && method === "GET") return json({ detail: "No repository connection." }, 404);
    if (url.includes("/analyses/latest") && method === "GET") return json({ detail: "No analysis yet." }, 404);
    if (url.includes("/analyses") && method === "GET") return json([]);
    if (url.includes("/health-checks/latest") && method === "GET") return json({ detail: "No health check yet." }, 404);
    if (url.includes("/health-checks") && method === "GET") return json([]);
    if (url.includes("/readiness/evidence-coverage") && method === "GET") {
      return json({
        project_id: 7,
        active_artifact_count: 0,
        linked_active_artifact_count: 0,
        unlinked_active_artifact_count: 0,
        readiness_items_with_evidence_count: 0,
        readiness_items_without_evidence_count: 0,
        readiness_evidence_link_count: 0,
        artifact_usage: [],
        readiness_items: [],
      });
    }
    if (url.includes("/readiness") && method === "GET") {
      return json({
        score: null,
        status: "not_started",
        passed: 0,
        failed: 0,
        unknown: 0,
        not_applicable: 0,
        total_applicable: 0,
        top_gaps: [],
        items: [],
      });
    }
    if (url.includes("/launch-report") && method === "GET") return json({ detail: "No launch report." }, 404);
    if (url.includes("/launch-checklist") && method === "GET") return json({ detail: "No launch checklist." }, 404);
    if (url.includes("/artifacts") && method === "GET") return json([]);
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
