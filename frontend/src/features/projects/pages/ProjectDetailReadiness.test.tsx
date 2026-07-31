import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch } from "../../../test/mockApi";

const project = makeProject({
  id: 7,
  name: "CivicPermit API",
  production_url: "https://civicpermit.example.com/health",
});

const notStartedReadiness = {
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

const evaluatedReadiness = {
  score: 44,
  status: "needs_work",
  passed: 4,
  failed: 2,
  unknown: 3,
  not_applicable: 0,
  total_applicable: 9,
  top_gaps: ["CI Configured", "Latest Health Check Healthy"],
  items: [
    {
      id: 31,
      project_id: 7,
      readiness_item_id: 1,
      item: {
        id: 1,
        key: "readme_present",
        label: "README Present",
        description: "The repository has a README.md at its root.",
        category: "documentation",
        evaluation_type: "automatic",
        sort_order: 10,
        is_active: true,
      },
      status: "failed",
      source: "codemap",
      evidence: { analysis_id: 12, signal: "has_readme", value: false },
      notes: null,
      evaluated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 32,
      project_id: 7,
      readiness_item_id: 6,
      item: {
        id: 6,
        key: "latest_health_check_healthy",
        label: "Latest Health Check Healthy",
        description: "The most recent health check returned a healthy status.",
        category: "observability",
        evaluation_type: "automatic",
        sort_order: 60,
        is_active: true,
      },
      status: "unknown",
      source: "health_check",
      evidence: null,
      notes: null,
      evaluated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 33,
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
      status: "unknown",
      source: "manual",
      evidence: null,
      notes: "Needs security lead review.",
      evaluated_at: "2026-01-01T00:00:00Z",
    },
  ],
};

const updatedManualItem = {
  ...evaluatedReadiness.items[2],
  status: "passed",
  notes: "Reviewed by security lead.",
};

const artifact = {
  id: 12,
  project_id: 7,
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
};

const linkedEvidence = {
  id: 5,
  project_id: 7,
  readiness_item_id: 9,
  item_key: "secrets_management_reviewed",
  artifact,
  created_at: "2026-01-03T00:00:00Z",
};

function renderDetail() {
  window.history.pushState({}, "", "/app/projects/7");
  return render(<App />);
}

function responseClone(response: Response) {
  return response.clone();
}

function mockProjectDetail({
  readinessResponse = json(notStartedReadiness),
  evaluateResponse = json(evaluatedReadiness, 201),
  updateItemResponse = json(updatedManualItem),
  artifactsResponse = json([artifact]),
  evidenceResponse = json([]),
  linkEvidenceResponse = json(linkedEvidence, 201),
  unlinkEvidenceResponse = json(undefined, 204),
}: {
  readinessResponse?: Response;
  evaluateResponse?: Response | Promise<Response>;
  updateItemResponse?: Response | Promise<Response>;
  artifactsResponse?: Response;
  evidenceResponse?: Response;
  linkEvidenceResponse?: Response | Promise<Response>;
  unlinkEvidenceResponse?: Response | Promise<Response>;
} = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/projects/7") && method === "GET") return json(project);
    if (url.endsWith("/api/v1/projects/7/repo") && method === "GET") {
      return json({ detail: "Project 7 does not have an attached repo." }, 404);
    }
    if (url.endsWith("/api/v1/projects/7/health-checks/latest") && method === "GET") {
      return json({ detail: "Project 7 does not have a health check yet." }, 404);
    }
    if (url.endsWith("/api/v1/projects/7/health-checks") && method === "GET") return json([]);
    if (url.endsWith("/api/v1/projects/7/readiness") && method === "GET") return responseClone(readinessResponse);
    if (url.endsWith("/api/v1/projects/7/readiness/evaluate") && method === "POST") {
      return evaluateResponse instanceof Promise ? evaluateResponse : responseClone(evaluateResponse);
    }
    if (url.endsWith("/api/v1/projects/7/artifacts") && method === "GET") return responseClone(artifactsResponse);
    if (url.includes("/api/v1/projects/7/readiness/items/") && url.endsWith("/artifacts") && method === "GET") {
      return responseClone(evidenceResponse);
    }
    if (url.endsWith("/api/v1/projects/7/readiness/items/secrets_management_reviewed/artifacts") && method === "POST") {
      return linkEvidenceResponse instanceof Promise ? linkEvidenceResponse : responseClone(linkEvidenceResponse);
    }
    if (url.endsWith("/api/v1/projects/7/readiness/items/secrets_management_reviewed/artifacts/12") && method === "DELETE") {
      return unlinkEvidenceResponse instanceof Promise ? unlinkEvidenceResponse : responseClone(unlinkEvidenceResponse);
    }
    if (url.endsWith("/api/v1/projects/7/readiness/items/secrets_management_reviewed") && method === "PATCH") {
      return updateItemResponse instanceof Promise ? updateItemResponse : responseClone(updateItemResponse);
    }
    return json([]);
  });
}

describe("Project detail Production Readiness", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a not-evaluated advisory readiness state", async () => {
    mockProjectDetail();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    expect(within(section).getByText("Evaluate readiness to see an advisory checklist based on available ProjectOps evidence.")).toBeInTheDocument();
    expect(within(section).getByText(/Readiness is an advisory assessment based on available ProjectOps evidence/)).toBeInTheDocument();
    expect(within(section).getByText(/This is not a deployment approval, security audit, or uptime guarantee/)).toBeInTheDocument();
    expect(within(section).getByText("Project metadata")).toBeInTheDocument();
    expect(within(section).getByText("Repository connection")).toBeInTheDocument();
    expect(within(section).getByText("CodeMap Lite analysis")).toBeInTheDocument();
    expect(within(section).getByText("Manual health check")).toBeInTheDocument();
    expect(within(section).getByText("Manual review items")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Run Readiness Evaluation" })).toBeEnabled();
    expect(within(section).queryByText(/certified/i)).not.toBeInTheDocument();
    expect(within(section).queryByText(/deployment approved/i)).not.toBeInTheDocument();
  });

  it("disables the evaluate button while pending and then shows the score summary", async () => {
    let resolveEvaluate: (response: Response) => void = () => undefined;
    const evaluateResponse = new Promise<Response>((resolve) => {
      resolveEvaluate = resolve;
    });
    mockProjectDetail({ evaluateResponse });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    await user.click(within(section).getByRole("button", { name: "Run Readiness Evaluation" }));

    expect(within(section).getByRole("button", { name: "Evaluating Readiness" })).toBeDisabled();
    expect(within(section).getByText("Readiness evaluation is running...")).toBeInTheDocument();

    resolveEvaluate(json(evaluatedReadiness, 201));

    expect(await within(section).findByText("44")).toBeInTheDocument();
    expect(within(section).getByText("Needs work")).toBeInTheDocument();
    expect(within(section).getByText("4 passed")).toBeInTheDocument();
    expect(within(section).getByText("2 failed")).toBeInTheDocument();
    expect(within(section).getByText("3 unknown")).toBeInTheDocument();
    expect(within(section).getByText("0 not applicable")).toBeInTheDocument();
    expect(within(section).getByText("CI Configured")).toBeInTheDocument();
    expect(within(section).getAllByText("Latest Health Check Healthy").length).toBeGreaterThan(0);
    const runAgainButton = within(section).getByRole("button", { name: "Run Readiness Evaluation" });
    await waitFor(() => expect(runAgainButton).toHaveFocus());
  });

  it("shows readiness evaluation errors without hiding Project metadata", async () => {
    mockProjectDetail({ evaluateResponse: json({ detail: "Readiness service unavailable." }, 500) });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    await user.click(within(section).getByRole("button", { name: "Run Readiness Evaluation" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent("Readiness service unavailable.");
    expect(screen.getByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
  });

  it("shows checklist items with evidence and protects automatic items from manual editing", async () => {
    mockProjectDetail({ readinessResponse: json(evaluatedReadiness) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    expect(await within(section).findByRole("heading", { name: "Readiness Checklist" })).toBeInTheDocument();
    expect(within(section).getByText("README Present")).toBeInTheDocument();
    expect(within(section).getAllByText("Failed").length).toBeGreaterThan(0);
    expect(within(section).getByText(/ProjectOps evaluated this item from the latest CodeMap Lite analysis/)).toBeInTheDocument();
    expect(within(section).getByText("Signal has_readme was not detected in analysis 12.")).toBeInTheDocument();
    expect(within(section).getAllByText("Latest Health Check Healthy").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("No evidence available yet.").length).toBeGreaterThan(0);
    expect(within(section).getByText(/Run CodeMap Lite or a manual health check to improve the evidence available to readiness/)).toBeInTheDocument();
    expect(within(section).getAllByText("Needs security lead review.").length).toBeGreaterThan(0);
    expect(within(section).queryByRole("button", { name: "Save README Present" })).not.toBeInTheDocument();
  });

  it("updates a manual readiness item status and notes", async () => {
    const fetchMock = mockProjectDetail({ readinessResponse: json(evaluatedReadiness) });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    await user.selectOptions(await within(section).findByLabelText("Status for Secrets Management Reviewed"), "passed");
    await user.clear(within(section).getByLabelText("Notes for Secrets Management Reviewed"));
    await user.type(within(section).getByLabelText("Notes for Secrets Management Reviewed"), "Reviewed by security lead.");
    await user.click(within(section).getByRole("button", { name: "Save Secrets Management Reviewed" }));

    expect(await within(section).findByText("Manual review saved.")).toBeInTheDocument();
    expect(within(section).getAllByText("Passed").length).toBeGreaterThan(0);
    expect(within(section).getByDisplayValue("Reviewed by security lead.")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/v1/projects/7/readiness/items/secrets_management_reviewed") &&
          init?.body === JSON.stringify({ status: "passed", notes: "Reviewed by security lead." }),
      ),
    ).toBe(true);
  });

  it("shows linked artifacts as supporting evidence without marking the item passed", async () => {
    mockProjectDetail({ readinessResponse: json(evaluatedReadiness), evidenceResponse: json([linkedEvidence]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    expect(await within(section).findByText("Supporting artifacts")).toBeInTheDocument();
    const evidenceList = await within(section).findByRole("list", {
      name: "Supporting artifacts for Secrets Management Reviewed",
    });
    expect(within(evidenceList).getByText("Deployment runbook")).toBeInTheDocument();
    expect(within(section).getByText(/Linked artifacts are references supplied by your team/)).toBeInTheDocument();
    expect(within(section).getAllByText("Unknown").length).toBeGreaterThan(0);
    expect(within(section).queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it("links an existing artifact to a readiness item and surfaces duplicate errors", async () => {
    const fetchMock = mockProjectDetail({
      readinessResponse: json(evaluatedReadiness),
      linkEvidenceResponse: json({ detail: "Artifact is already linked to this readiness item." }, 409),
    });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    await user.selectOptions(await within(section).findByLabelText("Artifact evidence for Secrets Management Reviewed"), "12");
    await user.click(within(section).getByRole("button", { name: "Link artifact evidence for Secrets Management Reviewed" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent("Artifact is already linked to this readiness item.");
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/v1/projects/7/readiness/items/secrets_management_reviewed/artifacts") &&
          init?.body === JSON.stringify({ artifact_id: 12 }),
      ),
    ).toBe(true);
  });

  it("links and unlinks artifact evidence in the checklist UI", async () => {
    mockProjectDetail({ readinessResponse: json(evaluatedReadiness) });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Production Readiness" });
    await user.selectOptions(await within(section).findByLabelText("Artifact evidence for Secrets Management Reviewed"), "12");
    await user.click(within(section).getByRole("button", { name: "Link artifact evidence for Secrets Management Reviewed" }));

    const evidenceList = await within(section).findByRole("list", {
      name: "Supporting artifacts for Secrets Management Reviewed",
    });
    expect(within(evidenceList).getByText("Deployment runbook")).toBeInTheDocument();
    expect(within(section).getAllByText("Unknown").length).toBeGreaterThan(0);

    await user.click(within(evidenceList).getByRole("button", { name: "Unlink Deployment runbook from Secrets Management Reviewed" }));

    await waitFor(() => {
      expect(
        within(section).queryByRole("list", { name: "Supporting artifacts for Secrets Management Reviewed" }),
      ).not.toBeInTheDocument();
    });
  });
});
