import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch } from "../../../test/mockApi";

const project = makeProject({
  id: 7,
  name: "CivicPermit API",
  repo_url: "https://github.com/example/metadata-only",
});

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

function renderDetail() {
  window.history.pushState({}, "", "/app/projects/7");
  return render(<App />);
}

function mockProjectDetailWithRepo(response: Response, attachResponse?: Response, removeResponse?: Response) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/projects/7/repo") && method === "GET") return response;
    if (url.endsWith("/api/v1/projects/7/repo") && method === "POST") return attachResponse ?? json(repo, 201);
    if (url.endsWith("/api/v1/projects/7/repo") && method === "DELETE") return removeResponse ?? new Response(null, { status: 204 });
    if (url.endsWith("/api/v1/projects/7/analyses/latest") && method === "GET") {
      return json({ detail: "Project 7 does not have a repo analysis yet." }, 404);
    }
    if (url.endsWith("/api/v1/projects/7/analyses") && method === "GET") return json([]);
    if (url.endsWith("/api/v1/projects/7") && method === "GET") return json(project);
    return json([]);
  });
}

describe("Project detail repository connection", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows project metadata and an empty repository connection state when no repo is attached", async () => {
    mockProjectDetailWithRepo(json({ detail: "Project 7 does not have an attached repo." }, 404));

    renderDetail();

    expect(await screen.findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Repository Connection" });
    expect(within(section).getByText("No repository connected")).toBeInTheDocument();
    expect(within(section).getByLabelText("GitHub repository URL")).toBeInTheDocument();
    expect(within(section).getByText(/ProjectOps stores the repository connection first/)).toBeInTheDocument();
  });

  it("shows a loading state while repository connection state loads", async () => {
    mockFetch((url, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/v1/projects/7/repo") && method === "GET") return new Promise<Response>(() => undefined);
      if (url.endsWith("/api/v1/projects/7/analyses/latest") && method === "GET") {
      return json({ detail: "Project 7 does not have a repo analysis yet." }, 404);
    }
    if (url.endsWith("/api/v1/projects/7/analyses") && method === "GET") return json([]);
    if (url.endsWith("/api/v1/projects/7") && method === "GET") return json(project);
      return json([]);
    });

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    expect(within(section).getByText("Loading repository connection...")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
  });

  it("keeps project metadata visible when repository loading fails", async () => {
    mockProjectDetailWithRepo(json({ detail: "Repository service unavailable." }, 500));

    renderDetail();

    expect(await screen.findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Repository Connection" });
    expect(await within(section).findByRole("alert")).toHaveTextContent("Repository service unavailable.");
  });

  it("shows connected repository details from RepoIntegration", async () => {
    mockProjectDetailWithRepo(json(repo));

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    expect(within(section).getByText("openai/codex")).toBeInTheDocument();
    expect(within(section).getByText("github")).toBeInTheDocument();
    expect(within(section).getByText("https://github.com/openai/codex")).toBeInTheDocument();
    expect(within(section).getByText("Connected")).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: /Run CodeMap Analysis/ })).not.toBeInTheDocument();
    expect(screen.getByText("https://github.com/example/metadata-only")).toBeInTheDocument();
  });

  it("validates that a repository URL is entered before attaching", async () => {
    const fetchMock = mockProjectDetailWithRepo(json({ detail: "Project 7 does not have an attached repo." }, 404));
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.click(within(section).getByRole("button", { name: "Attach Repository" }));

    expect(within(section).getByText("Enter a GitHub repository URL.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => (init?.method ?? "GET").toUpperCase() === "POST")).toBe(false);
  });

  it("attaches a repository and updates the connection state", async () => {
    const fetchMock = mockProjectDetailWithRepo(json({ detail: "Project 7 does not have an attached repo." }, 404), json(repo, 201));
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.type(within(section).getByLabelText("GitHub repository URL"), "https://github.com/openai/codex.git");
    await user.click(within(section).getByRole("button", { name: "Attach Repository" }));

    expect(await within(section).findByText("openai/codex")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.body === JSON.stringify({ repo_url: "https://github.com/openai/codex.git" }))).toBe(true);
  });

  it("shows backend validation errors for invalid GitHub URLs", async () => {
    mockProjectDetailWithRepo(
      json({ detail: "Project 7 does not have an attached repo." }, 404),
      json({ detail: "Enter a valid GitHub repository URL." }, 422),
    );
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.type(within(section).getByLabelText("GitHub repository URL"), "https://gitlab.com/openai/codex");
    await user.click(within(section).getByRole("button", { name: "Attach Repository" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent("Enter a valid GitHub repository URL.");
    expect(within(section).getByRole("button", { name: "Attach Repository" })).toBeInTheDocument();
  });

  it("allows replacing the connected repository", async () => {
    const replacement = { ...repo, repo_owner: "python", repo_name: "cpython", repo_url: "https://github.com/python/cpython" };
    const fetchMock = mockProjectDetailWithRepo(json(repo), json(replacement, 201));
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.click(within(section).getByRole("button", { name: "Replace Repository" }));
    expect(within(section).getByText(/Replacing updates the repository connected to this Project/)).toBeInTheDocument();
    expect(within(section).getByLabelText("GitHub repository URL")).toHaveValue("https://github.com/openai/codex");

    const input = within(section).getByLabelText("GitHub repository URL");
    await user.clear(input);
    await user.type(input, "git@github.com:python/cpython.git");
    await user.click(within(section).getByRole("button", { name: "Replace Repository" }));

    expect(await within(section).findByText("python/cpython")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.body === JSON.stringify({ repo_url: "git@github.com:python/cpython.git" }))).toBe(true);
  });

  it("opens and cancels repository removal", async () => {
    mockProjectDetailWithRepo(json(repo));
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.click(within(section).getByRole("button", { name: "Remove Repository" }));
    expect(screen.getByRole("dialog", { name: "Remove repository connection?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Remove repository connection?" })).not.toBeInTheDocument();
    await waitFor(() => expect(within(section).getByRole("button", { name: "Remove Repository" })).toHaveFocus());
    expect(within(section).getByText("openai/codex")).toBeInTheDocument();
  });

  it("closes repository removal on Escape", async () => {
    mockProjectDetailWithRepo(json(repo));
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.click(within(section).getByRole("button", { name: "Remove Repository" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Remove repository connection?" })).not.toBeInTheDocument();
    expect(within(section).getByText("openai/codex")).toBeInTheDocument();
  });

  it("removes the repository connection and returns to the empty state", async () => {
    mockProjectDetailWithRepo(json(repo));
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.click(within(section).getByRole("button", { name: "Remove Repository" }));
    await user.click(screen.getByRole("button", { name: "Remove Connection" }));

    expect(await within(section).findByText("No repository connected")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
  });

  it("keeps the connected state and shows an error when removal fails", async () => {
    mockProjectDetailWithRepo(json(repo), undefined, json({ detail: "Repository connection could not be removed." }, 500));
    const user = userEvent.setup();

    renderDetail();

    const section = await screen.findByRole("region", { name: "Repository Connection" });
    await user.click(within(section).getByRole("button", { name: "Remove Repository" }));
    await user.click(screen.getByRole("button", { name: "Remove Connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Repository connection could not be removed.");
    expect(within(section).getByText("openai/codex")).toBeInTheDocument();
  });

  it("keeps Repository Analysis navigation as a future-state item", async () => {
    mockProjectDetailWithRepo(json(repo));

    renderDetail();

    expect(await screen.findByRole("button", { name: "Repository Analysis Later" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});



