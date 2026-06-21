import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { mockProjectsApi } from "../../test/mockApi";

function renderApp() {
  window.history.pushState({}, "", "/app/overview");
  return render(<App />);
}

describe("Theme control", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });
  afterEach(() => vi.restoreAllMocks());

  it("starts in dark mode with an explicit, accessible label", async () => {
    mockProjectsApi({ list: [] });
    renderApp();

    const toggle = await screen.findByRole("button", { name: "Switch to light theme" });
    expect(toggle).toHaveTextContent("Theme: Dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles the document theme and updates its visible label", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toHaveTextContent("Theme: Light");

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("keeps an explicit accessible label in both modes (never an empty icon control)", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    const dark = await screen.findByRole("button", { name: "Switch to light theme" });
    expect(dark.textContent?.trim()).not.toBe("");
    await user.click(dark);
    const light = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(light.textContent?.trim()).not.toBe("");
  });

  it("persists the chosen theme to storage", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Switch to light theme" }));
    expect(localStorage.getItem("projectops-theme")).toBe("light");
  });
});
