import { render, screen } from "@testing-library/react";
import { App } from "../../app/App";
import { mockProjectsApi } from "../../test/mockApi";

describe("Layout accessibility", () => {
  afterEach(() => vi.restoreAllMocks());

  it("exposes a skip link to the main content", async () => {
    mockProjectsApi({ list: [] });
    window.history.pushState({}, "", "/app/overview");
    render(<App />);

    const skip = await screen.findByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveAttribute("href", "#main-content");
  });

  it("marks the current page in the primary navigation", async () => {
    mockProjectsApi({ list: [] });
    window.history.pushState({}, "", "/app/projects");
    render(<App />);

    const current = await screen.findByRole("link", { name: "Projects", current: "page" });
    expect(current).toBeInTheDocument();
  });

  it("labels the primary navigation landmark", async () => {
    mockProjectsApi({ list: [] });
    window.history.pushState({}, "", "/app/overview");
    render(<App />);

    expect(await screen.findByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  });
});
