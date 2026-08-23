import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { makeProject, mockProjectsApi, signInTestUser } from "../../test/mockApi";

const project = makeProject();

describe("Project Registry", () => {
  beforeEach(() => {
    signInTestUser();
    window.history.pushState({}, "", "/app/projects");
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows loaded Projects, filters them, and changes view", async () => {
    mockProjectsApi({ list: [project] });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText("CivicPermit API")).toBeInTheDocument();
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
