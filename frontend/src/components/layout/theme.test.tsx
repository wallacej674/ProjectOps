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

  it("starts in dark mode with appearance controls inside the account menu", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    expect(screen.queryByText("Theme: Dark")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("changes the document theme from the account menu", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  it("keeps each appearance choice explicitly labeled", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveTextContent("Light");
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveTextContent("Dark");
  });

  it("persists the chosen theme to storage", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(localStorage.getItem("projectops-theme")).toBe("light");
  });
});
