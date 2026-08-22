import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { signInTestUser } from "../../test/mockApi";

const project = { id: 7, name: "CivicPermit API", description: "Permit workflow service", repo_url: null, production_url: null, status: "development", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" };

describe("Project Registry", () => {
  beforeEach(() => {
    signInTestUser();
    window.history.pushState({}, "", "/app/projects");
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows loaded Projects, filters them, and changes view", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([project]), { status: 200 })));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText("CivicPermit API")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search Projects" }), "no match");
    expect(screen.getByRole("heading", { name: "No matching Projects" })).toBeInTheDocument();
  });

  it("shows a useful empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "No Projects yet" })).toBeInTheDocument();
  });

  it("shows the backend request ID when Projects fail to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "ProjectOps hit an unexpected error." }), {
          status: 500,
          headers: { "X-Request-ID": "registry-load-123" },
        }),
      ),
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Projects could not load" })).toBeInTheDocument();
    expect(screen.getByText("Request ID: registry-load-123")).toBeInTheDocument();
  });
});
