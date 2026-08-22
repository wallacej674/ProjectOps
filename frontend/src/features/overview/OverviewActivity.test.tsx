import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { json, makeProject, mockFetch } from "../../test/mockApi";

const projects = [
  makeProject({ id: 7, name: "CivicPermit API", status: "development" }),
  makeProject({ id: 8, name: "LaunchBudget", status: "staging" }),
];

const activityEvents = [
  {
    id: 52,
    project_id: 8,
    project_name: "LaunchBudget",
    project_status: "staging",
    event_type: "health_check_healthy",
    event_category: "health",
    message: "Manual health check was healthy.",
    related_resource_type: "health_check",
    related_resource_id: 20,
    metadata: { http_status_code: 200 },
    created_at: "2026-01-08T12:00:00Z",
  },
  {
    id: 51,
    project_id: 7,
    project_name: "CivicPermit API",
    project_status: "development",
    event_type: "artifact_created",
    event_category: "artifact",
    message: "Deployment runbook was created.",
    related_resource_type: "project_artifact",
    related_resource_id: 41,
    metadata: { title: "Deployment runbook" },
    created_at: "2026-01-07T12:00:00Z",
  },
];

function goOverview() {
  window.history.pushState({}, "", "/app/overview");
}

function mockOverview({
  activityResponse = json(activityEvents),
  projectsResponse = json(projects),
  demoStatusResponse = json({ enabled: true, reason: null }),
}: {
  activityResponse?: Response;
  projectsResponse?: Response;
  demoStatusResponse?: Response;
} = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/demo-data/status") && method === "GET") return demoStatusResponse.clone();
    if (url.endsWith("/api/v1/projects?include_archived=true") && method === "GET") {
      return projectsResponse.clone();
    }
    if (url.endsWith("/api/v1/activity?limit=25") && method === "GET") return activityResponse.clone();
    return json([]);
  });
}

describe("Overview activity", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows cross-project recent activity with Project names and links", async () => {
    mockOverview();
    goOverview();
    render(<App />);

    const feed = await screen.findByRole("region", { name: "Recent Activity Across Projects" });
    expect(within(feed).getByText("Manual health check was healthy.")).toBeInTheDocument();
    expect(within(feed).getByText("LaunchBudget")).toBeInTheDocument();
    expect(within(feed).getByRole("link", { name: "Open LaunchBudget" })).toHaveAttribute(
      "href",
      "/app/projects/8",
    );
    expect(within(feed).getByText("Deployment runbook was created.")).toBeInTheDocument();
  });

  it("shows recently active Projects from the activity feed", async () => {
    mockOverview();
    goOverview();
    render(<App />);

    const projectsRegion = await screen.findByRole("region", { name: "Recently Active Projects" });
    expect(await within(projectsRegion).findByText("LaunchBudget")).toBeInTheDocument();
    expect(within(projectsRegion).getByText("Manual health check was healthy.")).toBeInTheDocument();
    expect(within(projectsRegion).getByRole("link", { name: "Open CivicPermit API" })).toHaveAttribute(
      "href",
      "/app/projects/7",
    );
  });

  it("shows loading, empty, and error states for cross-project activity", async () => {
    let resolveActivity: (response: Response) => void = () => undefined;
    const pendingActivity = new Promise<Response>((resolve) => {
      resolveActivity = resolve;
    });
    mockFetch((url, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/v1/projects?include_archived=true") && method === "GET") return json(projects);
      if (url.endsWith("/api/v1/activity?limit=25") && method === "GET") return pendingActivity;
      return json([]);
    });
    goOverview();
    const { unmount } = render(<App />);

    const feed = await screen.findByRole("region", { name: "Recent Activity Across Projects" });
    expect(within(feed).getByText("Loading recent activity...")).toBeInTheDocument();
    resolveActivity(json([]));
    expect(await within(feed).findByText("No activity recorded yet.")).toBeInTheDocument();

    unmount();
    vi.restoreAllMocks();
    mockOverview({ activityResponse: json({ detail: "Activity service unavailable." }, 500) });
    goOverview();
    render(<App />);

    const errorFeed = await screen.findByRole("region", { name: "Recent Activity Across Projects" });
    expect(await within(errorFeed).findByRole("alert")).toHaveTextContent("Activity service unavailable.");
  });

  it("filters, clears filters, and shows a filtered no-results state", async () => {
    const user = userEvent.setup();
    mockFetch((url, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/v1/projects?include_archived=true") && method === "GET") return json(projects);
      if (url.endsWith("/api/v1/activity?limit=25") && method === "GET") return json(activityEvents);
      if (url.endsWith("/api/v1/activity?category=artifact&limit=25") && method === "GET") {
        return json([activityEvents[1]]);
      }
      if (url.endsWith("/api/v1/activity?category=repository&limit=25") && method === "GET") return json([]);
      return json([]);
    });
    goOverview();
    render(<App />);

    const feed = await screen.findByRole("region", { name: "Recent Activity Across Projects" });
    await within(feed).findByText("Manual health check was healthy.");
    await user.selectOptions(within(feed).getByLabelText("Filter activity by category"), "artifact");

    expect(await within(feed).findByText("Deployment runbook was created.")).toBeInTheDocument();
    expect(within(feed).queryByText("Manual health check was healthy.")).not.toBeInTheDocument();

    await user.selectOptions(within(feed).getByLabelText("Filter activity by category"), "repository");
    expect(await within(feed).findByText("No activity matches these filters.")).toBeInTheDocument();

    await user.click(within(feed).getByRole("button", { name: "Clear activity filters" }));
    expect(await within(feed).findByText("Manual health check was healthy.")).toBeInTheDocument();
  });

  it("manually refreshes activity without changing the current filter", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch((url, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/v1/projects?include_archived=true") && method === "GET") return json(projects);
      if (url.endsWith("/api/v1/activity?limit=25") && method === "GET") return json(activityEvents);
      if (url.endsWith("/api/v1/activity?category=health&limit=25") && method === "GET") return json([activityEvents[0]]);
      return json([]);
    });
    goOverview();
    render(<App />);

    const feed = await screen.findByRole("region", { name: "Recent Activity Across Projects" });
    await within(feed).findByText("Manual health check was healthy.");
    await user.selectOptions(within(feed).getByLabelText("Filter activity by category"), "health");
    await within(feed).findByText("1 event shown");
    await user.click(within(feed).getByRole("button", { name: "Refresh activity" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/activity?category=health&limit=25",
      expect.any(Object),
    );
    expect(within(feed).getByDisplayValue("Health")).toBeInTheDocument();
  });

  it("shows first-run options when the workspace is empty", async () => {
    mockOverview({ activityResponse: json([]), projectsResponse: json([]) });
    goOverview();
    render(<App />);

    const panel = await screen.findByRole("region", { name: "Start with a Project, or load a sample workspace." });
    expect(within(panel).getByRole("link", { name: "Create Project" })).toHaveAttribute("href", "/app/projects/new");
    expect(within(panel).getByRole("button", { name: "Load demo workspace" })).toBeInTheDocument();
    expect(within(panel).getByText(/Demo data is sample material/i)).toBeInTheDocument();
  });

  it("seeds demo data and opens the demo Project", async () => {
    const user = userEvent.setup();
    const demoProject = makeProject({
      id: 99,
      name: "ProjectOps Demo Command Center",
      production_url: "https://demo.projectops.example.com",
      status: "staging",
    });
    const fetchMock = mockFetch((url, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/v1/demo-data/status") && method === "GET") return json({ enabled: true, reason: null });
      if (url.endsWith("/api/v1/projects?include_archived=true") && method === "GET") return json([]);
      if (url.endsWith("/api/v1/activity?limit=25") && method === "GET") return json([]);
      if (url.endsWith("/api/v1/demo-data/seed") && method === "POST") {
        return json({ created: true, project: demoProject, message: "Demo workspace was created." }, 201);
      }
      if (url.endsWith("/api/v1/projects/99") && method === "GET") return json(demoProject);
      if (url.endsWith("/api/v1/projects/99/repo") && method === "GET") {
        return json({ detail: "Project 99 does not have an attached repo." }, 404);
      }
      if (url.endsWith("/api/v1/projects/99/analyses/latest") && method === "GET") {
        return json({ detail: "Project 99 does not have a repo analysis yet." }, 404);
      }
      if (url.endsWith("/api/v1/projects/99/analyses") && method === "GET") return json([]);
      if (url.endsWith("/api/v1/projects/99/health-checks/latest") && method === "GET") {
        return json({ detail: "Project 99 does not have a health check yet." }, 404);
      }
      if (url.endsWith("/api/v1/projects/99/health-checks") && method === "GET") return json([]);
      if (url.endsWith("/api/v1/projects/99/readiness") && method === "GET") {
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
      if (url.endsWith("/api/v1/projects/99/artifacts") && method === "GET") return json([]);
      if (url.endsWith("/api/v1/projects/99/activity") && method === "GET") return json([]);
      return json([]);
    });
    goOverview();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Load demo workspace" }));

    await waitFor(() => expect(window.location.pathname).toBe("/app/projects/99"));
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/v1/demo-data/seed", expect.any(Object));
    expect(await screen.findByRole("heading", { name: "ProjectOps Demo Command Center" })).toBeInTheDocument();
  });

  it("explains when demo data is disabled", async () => {
    mockOverview({
      activityResponse: json([]),
      projectsResponse: json([]),
      demoStatusResponse: json({
        enabled: false,
        reason: "Demo data seeding is disabled in production environments.",
      }),
    });
    goOverview();
    render(<App />);

    const panel = await screen.findByRole("region", { name: "Start with a Project, or load a sample workspace." });
    expect(within(panel).queryByRole("button", { name: "Load demo workspace" })).not.toBeInTheDocument();
    expect(within(panel).getByText("Demo data seeding is disabled in production environments.")).toBeInTheDocument();
  });
});
