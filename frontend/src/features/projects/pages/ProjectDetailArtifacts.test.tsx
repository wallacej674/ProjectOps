import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch } from "../../../test/mockApi";

const project = makeProject({
  id: 7,
  name: "CivicPermit API",
  description: "Permit workflow service",
});

const artifact = {
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
  content: "Use the release checklist before production deploys.",
  summary: "Production deployment steps.",
  tags: "deployment,runbook",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const archivedArtifact = {
  ...artifact,
  id: 13,
  title: "Archived incident note",
  artifact_type: "incident",
  source_type: "manual",
  url: null,
  status: "archived",
};

const incidentArtifact = {
  ...artifact,
  id: 14,
  title: "Incident review note",
  artifact_type: "incident",
  source_type: "manual",
  url: "https://docs.example.com/incidents/cache",
  content: "Cache outage follow-up notes.",
  summary: "Reliability follow-up.",
  tags: "incident,reliability",
};

const defaultCoverage = {
  active_artifacts: 0,
  linked_active_artifacts: 0,
  unlinked_active_artifacts: 0,
  readiness_items_with_linked_artifacts: 0,
  readiness_items_without_linked_artifacts: 0,
  total_evidence_links: 0,
  artifact_usage: [],
  readiness_items: [],
};

const artifactCoverage = {
  active_artifacts: 2,
  linked_active_artifacts: 1,
  unlinked_active_artifacts: 1,
  readiness_items_with_linked_artifacts: 1,
  readiness_items_without_linked_artifacts: 1,
  total_evidence_links: 1,
  artifact_usage: [
    {
      artifact,
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
    {
      artifact: incidentArtifact,
      linked_item_count: 0,
      readiness_items: [],
    },
  ],
  readiness_items: [
    {
      readiness_item_id: 9,
      item_key: "deployment_docs_reviewed",
      label: "Deployment Docs Reviewed",
      status: "unknown",
      linked_artifact_count: 1,
      artifacts: [artifact],
    },
    {
      readiness_item_id: 10,
      item_key: "rollback_plan_reviewed",
      label: "Rollback Plan Reviewed",
      status: "unknown",
      linked_artifact_count: 0,
      artifacts: [],
    },
  ],
};

function renderDetail() {
  window.history.pushState({}, "", "/app/projects/7");
  return render(<App />);
}

function mockProjectDetailArtifacts({
  artifactsResponse = json([]),
  createResponse = json({ ...artifact, id: 20 }, 201),
  updateResponse = json({ ...artifact, title: "Updated runbook" }),
  archiveResponse = json({ ...artifact, status: "archived" }),
  coverageResponse = json(defaultCoverage),
}: {
  artifactsResponse?: Response;
  createResponse?: Response;
  updateResponse?: Response;
  archiveResponse?: Response;
  coverageResponse?: Response;
} = {}) {
  const artifactRequests: string[] = [];
  const artifacts = [artifactsResponse.clone()];

  const fetchMock = mockFetch(async (url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/projects/7") && method === "GET") return json(project);
    if (url.endsWith("/api/v1/projects/7/repo") && method === "GET") {
      return json({ detail: "Project 7 does not have an attached repo." }, 404);
    }
    if (url.endsWith("/api/v1/projects/7/readiness") && method === "GET") {
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
    if (url.endsWith("/api/v1/projects/7/readiness/evidence-coverage") && method === "GET") {
      return coverageResponse.clone();
    }
    if (
      url.includes("/api/v1/projects/7/artifacts?") &&
      url.includes("artifact_type=decision") &&
      url.includes("tags=launch-decision") &&
      method === "GET"
    ) {
      return json([]);
    }
    if (url.includes("/api/v1/projects/7/artifacts") && method === "GET") {
      artifactRequests.push(url);
      return artifacts.length > 1 ? artifacts.shift()! : artifacts[0].clone();
    }
    if (url.endsWith("/api/v1/projects/7/artifacts") && method === "POST") return createResponse.clone();
    if (url.endsWith("/api/v1/projects/7/artifacts/12") && method === "PATCH") return updateResponse.clone();
    if (url.endsWith("/api/v1/projects/7/artifacts/12") && method === "DELETE") return archiveResponse.clone();
    return json({ detail: "Not found." }, 404);
  });

  return { fetchMock, artifactRequests, queueArtifactsResponse: (response: Response) => artifacts.push(response.clone()) };
}

describe("Project detail Artifacts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the empty state without hiding Project metadata", async () => {
    mockProjectDetailArtifacts();

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    expect(within(artifactsSection).getByText("No artifacts yet.")).toBeInTheDocument();
    expect(within(artifactsSection).getByRole("button", { name: "Add Artifact" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Project Details" })).toBeInTheDocument();
  });

  it("shows artifact loading errors without hiding Project metadata", async () => {
    mockProjectDetailArtifacts({ artifactsResponse: json({ detail: "Artifact service unavailable." }, 500) });

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    expect(await within(artifactsSection).findByRole("alert")).toHaveTextContent("Artifact service unavailable.");
    expect(screen.getByRole("region", { name: "Project Details" })).toBeInTheDocument();
  });

  it("renders artifacts and filters by type", async () => {
    const { artifactRequests } = mockProjectDetailArtifacts({
      artifactsResponse: json([artifact]),
      coverageResponse: json(artifactCoverage),
    });

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    expect(await within(artifactsSection).findByText("Deployment runbook")).toBeInTheDocument();
    expect(within(artifactsSection).getByText("Production deployment steps.")).toBeInTheDocument();
    expect(within(artifactsSection).getByText("Supports 1 readiness item: Deployment Docs Reviewed")).toBeInTheDocument();
    expect(within(artifactsSection).getByRole("link", { name: "Open artifact URL" })).toHaveAttribute(
      "href",
      "https://docs.example.com/runbook",
    );

    await userEvent.selectOptions(within(artifactsSection).getByLabelText("Filter artifacts by type"), "runbook");

    await waitFor(() => {
      expect(artifactRequests.at(-1)).toContain("artifact_type=runbook");
    });
  });

  it("filters artifacts by readiness evidence usage", async () => {
    mockProjectDetailArtifacts({
      artifactsResponse: json([artifact, incidentArtifact]),
      coverageResponse: json(artifactCoverage),
    });

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    expect(await within(artifactsSection).findByText("Deployment runbook")).toBeInTheDocument();
    expect(within(artifactsSection).getByText("Incident review note")).toBeInTheDocument();
    expect(within(artifactsSection).getByText("Not currently linked to readiness evidence.")).toBeInTheDocument();

    await userEvent.selectOptions(within(artifactsSection).getByLabelText("Filter artifacts by readiness evidence usage"), "linked");

    expect(within(artifactsSection).getByText("Deployment runbook")).toBeInTheDocument();
    expect(within(artifactsSection).queryByText("Incident review note")).not.toBeInTheDocument();
    expect(within(artifactsSection).getByText("1 artifact shown")).toBeInTheDocument();

    await userEvent.selectOptions(within(artifactsSection).getByLabelText("Filter artifacts by readiness evidence usage"), "unlinked");

    expect(within(artifactsSection).queryByText("Deployment runbook")).not.toBeInTheDocument();
    expect(within(artifactsSection).getByText("Incident review note")).toBeInTheDocument();
  });

  it("searches artifacts, shows no-results, and clears filters", async () => {
    const { artifactRequests, queueArtifactsResponse } = mockProjectDetailArtifacts({
      artifactsResponse: json([artifact, incidentArtifact]),
    });
    queueArtifactsResponse(json([artifact]));
    queueArtifactsResponse(json([]));
    queueArtifactsResponse(json([artifact, incidentArtifact]));

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    expect(await within(artifactsSection).findByText("2 artifacts shown")).toBeInTheDocument();

    await userEvent.type(within(artifactsSection).getByLabelText("Search artifacts"), "d");

    await waitFor(() => {
      expect(artifactRequests.at(-1)).toContain("search=d");
    });
    expect(await within(artifactsSection).findByText("Deployment runbook")).toBeInTheDocument();
    expect(within(artifactsSection).queryByText("Incident review note")).not.toBeInTheDocument();
    expect(within(artifactsSection).getByText("1 artifact shown")).toBeInTheDocument();

    await userEvent.type(within(artifactsSection).getByLabelText("Search artifacts"), "z");

    await waitFor(() => {
      expect(artifactRequests.at(-1)).toContain("search=dz");
    });
    expect(await within(artifactsSection).findByText("No artifacts match these filters.")).toBeInTheDocument();

    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Clear artifact filters" }));

    await waitFor(() => {
      expect(artifactRequests.at(-1)).not.toContain("search=");
    });
    expect(await within(artifactsSection).findByText("2 artifacts shown")).toBeInTheDocument();
  });

  it("renders tag chips and filters artifacts by tag", async () => {
    const { artifactRequests, queueArtifactsResponse } = mockProjectDetailArtifacts({
      artifactsResponse: json([artifact, incidentArtifact]),
    });
    queueArtifactsResponse(json([incidentArtifact]));

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    expect(await within(artifactsSection).findByRole("button", { name: "Filter by tag deployment" })).toBeInTheDocument();
    expect(within(artifactsSection).getByRole("button", { name: "Filter by tag reliability" })).toBeInTheDocument();

    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Filter by tag reliability" }));

    await waitFor(() => {
      expect(artifactRequests.at(-1)).toContain("tags=reliability");
    });
    expect(await within(artifactsSection).findByText("Incident review note")).toBeInTheDocument();
    expect(within(artifactsSection).queryByText("Deployment runbook")).not.toBeInTheDocument();
    expect(within(artifactsSection).getByText("Filters active")).toBeInTheDocument();
  });

  it("creates an artifact and updates the list", async () => {
    const { queueArtifactsResponse } = mockProjectDetailArtifacts();
    queueArtifactsResponse(json([{ ...artifact, id: 20, title: "Architecture note", artifact_type: "note", source_type: "manual" }]));

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Add Artifact" }));
    await userEvent.type(within(artifactsSection).getByLabelText("Title"), "Architecture note");
    await userEvent.type(within(artifactsSection).getByLabelText("Summary"), "Service boundaries and operating notes.");
    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Create Artifact" }));

    expect(await within(artifactsSection).findByText("Architecture note")).toBeInTheDocument();
  });

  it("validates required title and URL before create", async () => {
    mockProjectDetailArtifacts();

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Add Artifact" }));
    await userEvent.type(within(artifactsSection).getByLabelText("URL"), "not-a-url");
    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Create Artifact" }));

    expect(within(artifactsSection).getByText("Title is required.")).toBeInTheDocument();
    expect(within(artifactsSection).getByText("Enter a valid HTTP or HTTPS URL.")).toBeInTheDocument();
  });

  it("prepopulates edit values and updates an artifact", async () => {
    const { queueArtifactsResponse } = mockProjectDetailArtifacts({ artifactsResponse: json([artifact]) });
    queueArtifactsResponse(json([{ ...artifact, title: "Updated runbook" }]));

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    await within(artifactsSection).findByText("Deployment runbook");
    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Edit Deployment runbook" }));

    const title = within(artifactsSection).getByLabelText("Title");
    expect(title).toHaveValue("Deployment runbook");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated runbook");
    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Save Artifact" }));

    expect(await within(artifactsSection).findByText("Updated runbook")).toBeInTheDocument();
  });

  it("archives an artifact and can include archived records", async () => {
    const { queueArtifactsResponse } = mockProjectDetailArtifacts({ artifactsResponse: json([artifact]) });
    queueArtifactsResponse(json([]));
    queueArtifactsResponse(json([archivedArtifact]));

    renderDetail();

    const artifactsSection = await screen.findByRole("region", { name: "Project Artifacts" });
    await within(artifactsSection).findByText("Deployment runbook");
    await userEvent.click(within(artifactsSection).getByRole("button", { name: "Archive Deployment runbook" }));
    expect(screen.getByRole("dialog", { name: "Archive Deployment runbook?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Archive Artifact" }));

    expect(await within(artifactsSection).findByText("No artifacts yet.")).toBeInTheDocument();
    await userEvent.click(within(artifactsSection).getByLabelText("Include archived artifacts"));

    expect(await within(artifactsSection).findByText("Archived incident note")).toBeInTheDocument();
    expect(within(artifactsSection).getByText("Archived")).toBeInTheDocument();
  });
});
