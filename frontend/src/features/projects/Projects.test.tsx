import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";

const project = { id: 7, name: "CivicPermit API", description: "Permit workflow service", repo_url: null, production_url: null, status: "development", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" };

describe("Project Registry", () => {
  beforeEach(() => { window.history.pushState({}, "", "/app/projects"); });
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
});
