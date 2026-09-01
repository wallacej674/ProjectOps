import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch } from "../../../test/mockApi";

const projectWithoutProductionUrl = makeProject({
  id: 7,
  name: "CivicPermit API",
  production_url: null,
});

const projectWithProductionUrl = makeProject({
  id: 7,
  name: "CivicPermit API",
  production_url: "https://civicpermit.example.com/health",
});

const healthyCheck = {
  id: 21,
  project_id: 7,
  target_url: "https://civicpermit.example.com/health",
  status: "healthy",
  execution_source: "manual",
  http_status_code: 200,
  response_time_ms: 184,
  checked_at: "2026-01-01T00:00:00Z",
  error_message: null,
  response_preview: "ok",
  created_at: "2026-01-01T00:00:01Z",
};

const disabledMonitor = {
  project_id: 7,
  enabled: false,
  cadence_minutes: 60,
  next_run_at: null,
  last_started_at: null,
  last_completed_at: null,
  last_outcome: null,
  consecutive_failures: 0,
  created_at: null,
  updated_at: null,
};

const unhealthyCheck = {
  ...healthyCheck,
  id: 22,
  status: "unhealthy",
  http_status_code: 500,
  response_preview: "server error",
};

const timeoutCheck = {
  ...healthyCheck,
  id: 23,
  status: "timeout",
  http_status_code: null,
  response_time_ms: 5000,
  error_message: "Request timed out.",
  response_preview: null,
};

const errorCheck = {
  ...healthyCheck,
  id: 24,
  status: "error",
  http_status_code: null,
  response_time_ms: 42,
  error_message: "Network is unreachable.",
  response_preview: null,
};

function renderDetail() {
  window.history.pushState({}, "", "/app/projects/7");
  return render(<App />);
}

function responseClone(response: Response) {
  return response.clone();
}

function mockProjectDetail({
  project = projectWithProductionUrl,
  latestHealthResponse = json({ detail: "Project 7 does not have a health check yet." }, 404),
  healthHistoryResponse = json([]),
  runHealthResponse = json(healthyCheck, 201),
  monitorResponse = json(disabledMonitor),
}: {
  project?: ReturnType<typeof makeProject>;
  latestHealthResponse?: Response;
  healthHistoryResponse?: Response;
  runHealthResponse?: Response | Promise<Response>;
  monitorResponse?: Response;
} = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/projects/7") && method === "GET") return json(project);
    if (url.endsWith("/api/v1/projects/7/repo") && method === "GET") {
      return json({ detail: "Project 7 does not have an attached repo." }, 404);
    }
    if (url.endsWith("/api/v1/projects/7/health-checks/latest") && method === "GET") {
      return responseClone(latestHealthResponse);
    }
    if (url.endsWith("/api/v1/projects/7/health-checks/run") && method === "POST") {
      return runHealthResponse instanceof Promise ? runHealthResponse : responseClone(runHealthResponse);
    }
    if (url.endsWith("/api/v1/projects/7/health-checks") && method === "GET") {
      return responseClone(healthHistoryResponse);
    }
    if (url.endsWith("/api/v1/projects/7/health-monitor") && method === "GET") {
      return responseClone(monitorResponse);
    }
    if (url.endsWith("/api/v1/projects/7/health-monitor") && method === "PUT") {
      return json({ ...disabledMonitor, enabled: true, next_run_at: "2026-01-01T01:00:00Z" });
    }
    if (url.endsWith("/api/v1/projects/7/health-monitor") && method === "DELETE") {
      return json(disabledMonitor);
    }
    return json([]);
  });
}

describe("Project detail Health Monitoring", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a no-production-URL state before health checks can run", async () => {
    mockProjectDetail({ project: projectWithoutProductionUrl });

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(within(section).getByText("Add a production URL before running a health check.")).toBeInTheDocument();
    expect(within(section).getByText(/This does not mean the project is unhealthy/)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Edit Project" })).toHaveAttribute("href", "/app/projects/7/edit");
    expect(within(section).getByRole("button", { name: "Run Health Check" })).toBeDisabled();
  });

  it("shows a ready-to-check state when production URL exists but no checks exist", async () => {
    mockProjectDetail();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(within(section).getByText("https://civicpermit.example.com/health")).toBeInTheDocument();
    expect(within(section).getByText("No health check has been run yet.")).toBeInTheDocument();
    expect(within(section).getByText(/Manual checks are run only when you start them/)).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Run Health Check" })).toBeEnabled();
    expect(within(section).getByLabelText("Check a different URL this time")).toBeInTheDocument();
    expect(within(section).queryByText(/scheduled uptime monitoring is enabled/i)).not.toBeInTheDocument();
  });

  it("lets the user enable scheduled monitoring with a supported cadence", async () => {
    const fetchMock = mockProjectDetail();
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(await within(section).findByText("Scheduled monitoring is paused.")).toBeInTheDocument();
    await user.selectOptions(within(section).getByLabelText("Monitoring frequency"), "60");
    await user.click(within(section).getByRole("button", { name: "Enable scheduled monitoring" }));

    expect(await within(section).findByText("Scheduled monitoring is enabled.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).endsWith("/health-monitor") && init?.method === "PUT" &&
      init.body === JSON.stringify({ enabled: true, cadence_minutes: 60 })
    )).toBe(true);
  });

  it("disables the Run Health Check button while pending and then shows the result", async () => {
    let resolveRun: (response: Response) => void = () => undefined;
    const runHealthResponse = new Promise<Response>((resolve) => {
      resolveRun = resolve;
    });
    mockProjectDetail({ runHealthResponse });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    await user.click(within(section).getByRole("button", { name: "Run Health Check" }));

    expect(within(section).getByRole("button", { name: "Running Health Check" })).toBeDisabled();
    expect(within(section).getByText("Manual health check is running...")).toBeInTheDocument();

    resolveRun(json(healthyCheck, 201));

    expect(await within(section).findByText("Healthy")).toBeInTheDocument();
    const runAgainButton = within(section).getByRole("button", { name: "Run Again" });
    expect(runAgainButton).toBeEnabled();
    await waitFor(() => expect(runAgainButton).toHaveFocus());
  });

  it("sends the one-time override URL without changing the saved Project target", async () => {
    const fetchMock = mockProjectDetail({
      runHealthResponse: json({ ...healthyCheck, target_url: "https://status.example.com/ready" }, 201),
    });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    await user.click(within(section).getByLabelText("Check a different URL this time"));
    await user.type(within(section).getByLabelText("One-time health-check URL"), "https://status.example.com/ready");
    await user.click(within(section).getByRole("button", { name: "Run Health Check" }));

    expect((await within(section).findAllByText("https://status.example.com/ready")).length).toBeGreaterThan(0);
    expect(within(section).getByText("https://civicpermit.example.com/health")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.body === JSON.stringify({ url: "https://status.example.com/ready" }))).toBe(true);
  });

  it.each([
    { check: healthyCheck, label: "Healthy", meaning: "The endpoint responded with a 2xx or 3xx status." },
    { check: unhealthyCheck, label: "Unhealthy", meaning: "The endpoint responded, but returned a 4xx or 5xx status." },
    { check: timeoutCheck, label: "Timeout", meaning: "The endpoint did not respond before the health-check timeout." },
    { check: errorCheck, label: "Error", meaning: "ProjectOps could not complete the request because of a network or client error." },
  ])("shows the latest $label health result clearly", async ({ check, label, meaning }) => {
    mockProjectDetail({ latestHealthResponse: json(check), healthHistoryResponse: json([check]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(await within(section).findByText(label)).toBeInTheDocument();
    expect(within(section).getByText(meaning)).toBeInTheDocument();
    expect(within(section).getAllByText(check.target_url).some((element) => element.classList.contains("mono"))).toBe(true);
    if (check.http_status_code) expect(within(section).getAllByText(`HTTP ${check.http_status_code}`).length).toBeGreaterThan(0);
    if (check.response_time_ms !== null) expect(within(section).getAllByText(`${check.response_time_ms} ms`).length).toBeGreaterThan(0);
    if (check.response_preview) expect(within(section).getByText(check.response_preview)).toBeInTheDocument();
    if (check.error_message) expect(within(section).getByText(check.error_message)).toBeInTheDocument();
  });

  it("shows health-check history with latest marker", async () => {
    const olderCheck = { ...healthyCheck, id: 20, response_time_ms: 301, checked_at: "2025-12-31T00:00:00Z" };
    mockProjectDetail({ latestHealthResponse: json(healthyCheck), healthHistoryResponse: json([healthyCheck, olderCheck]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    expect(await within(section).findByRole("heading", { name: "Health Check History" })).toBeInTheDocument();
    expect(await within(section).findByText("Latest attempt")).toBeInTheDocument();
    expect(await within(section).findByText("301 ms")).toBeInTheDocument();
  });

  it("shows backend validation errors without hiding Project metadata", async () => {
    mockProjectDetail({ runHealthResponse: json({ detail: "Provide a URL or set production_url on the Project." }, 400) });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    await user.click(within(section).getByRole("button", { name: "Run Health Check" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent("Provide a URL or set production_url on the Project.");
    expect(screen.getByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
  });

  it("shows SSRF-blocked URL errors clearly", async () => {
    mockProjectDetail({
      runHealthResponse: json({ detail: "Target '127.0.0.1' resolves to a non-public address and is not allowed." }, 422),
    });
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    await user.click(within(section).getByLabelText("Check a different URL this time"));
    await user.type(within(section).getByLabelText("One-time health-check URL"), "http://127.0.0.1");
    await user.click(within(section).getByRole("button", { name: "Run Health Check" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent(
      "ProjectOps blocked this URL because health checks cannot target local, private, link-local, or otherwise unsafe network addresses.",
    );
  });

  it("keeps Health Monitoring stable when latest health loading fails", async () => {
    mockProjectDetail({ latestHealthResponse: json({ detail: "Health service unavailable." }, 500) });

    renderDetail();

    expect(await screen.findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Health Monitoring" });
    expect(await within(section).findByRole("alert")).toHaveTextContent("Health service unavailable.");
    expect(within(section).getByRole("button", { name: "Run Health Check" })).toBeEnabled();
  });

  it("renders long target URLs in readable monospace rows", async () => {
    const longTargetUrl =
      "https://status.example.com/very/deep/project/environment/production/region/us-east-1/service/api/health/readiness";
    const checkWithLongUrl = { ...healthyCheck, target_url: longTargetUrl };
    mockProjectDetail({ latestHealthResponse: json(checkWithLongUrl), healthHistoryResponse: json([checkWithLongUrl]) });

    renderDetail();

    const section = await screen.findByRole("region", { name: "Health Monitoring" });
    expect((await within(section).findAllByText(longTargetUrl)).some((element) => element.classList.contains("mono"))).toBe(true);
  });

  it("keeps Health Monitoring navigation as a future-state item", async () => {
    mockProjectDetail();

    renderDetail();

    expect(await screen.findByRole("button", { name: "Health Monitoring Later" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
