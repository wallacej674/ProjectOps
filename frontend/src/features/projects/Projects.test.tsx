import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { makeProject, mockProjectsApi, signInTestUser } from "../../test/mockApi";

const project = makeProject({
  repo_url: "https://github.com/example/civic-permit",
  production_url: "https://civicpermit.example.com",
  status: "production",
});
const missingSetupProject = makeProject({ id: 8, name: "Docs Portal" });

describe("Project Registry", () => {
  beforeEach(() => {
    signInTestUser();
    window.history.pushState({}, "", "/app/projects");
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows loaded Projects, filters them, and changes view", async () => {
    mockProjectsApi({
      list: [project, missingSetupProject],
      health: [
        {
          project_id: project.id,
          project_name: project.name,
          project_status: project.status,
          production_url: project.production_url,
          latest_check: {
            id: 11,
            project_id: project.id,
            target_url: project.production_url!,
            status: "healthy",
            http_status_code: 200,
            response_time_ms: 128,
            checked_at: "2026-08-01T12:00:00Z",
            error_message: null,
            response_preview: null,
            created_at: "2026-08-01T12:00:00Z",
          },
        },
      ],
      readiness: [
        {
          project_id: project.id,
          project_name: project.name,
          project_status: project.status,
          score: 91,
          status: "strong",
          passed: 9,
          failed: 0,
          unknown: 1,
          not_applicable: 0,
          total_applicable: 10,
          top_gaps: [],
        },
      ],
    });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText("CivicPermit API")).toBeInTheDocument();

    const portfolio = screen.getByRole("region", { name: "Project portfolio summary" });
    expect(within(portfolio).getByText("Total projects").closest("div")).toHaveTextContent("2");
    expect(within(portfolio).getByText("Needs attention").closest("div")).toHaveTextContent("1");
    expect(within(portfolio).getByText("Healthy").closest("div")).toHaveTextContent("1");
    expect(within(portfolio).getByText("Missing setup").closest("div")).toHaveTextContent("1");
    expect(screen.getByText("91/100")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Needs attention 1" }));
    expect(screen.getByText("Docs Portal")).toBeInTheDocument();
    expect(screen.queryByText("CivicPermit API")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All active 2" }));

    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search Projects" }), "no match");
    expect(screen.getByRole("heading", { name: "No matching Projects" })).toBeInTheDocument();
  });

  it("shows a useful empty state", async () => {
    mockProjectsApi({ list: [] });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "No Projects yet" })).toBeInTheDocument();
  });

  it("shows the backend request ID when Projects fail to load", async () => {
    mockProjectsApi({
      list: new Response(JSON.stringify({ detail: "ProjectOps hit an unexpected error." }), {
        status: 500,
        headers: { "Content-Type": "application/json", "X-Request-ID": "registry-load-123" },
      }),
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Projects could not load" })).toBeInTheDocument();
    expect(screen.getByText("Request ID: registry-load-123")).toBeInTheDocument();
  });
});
