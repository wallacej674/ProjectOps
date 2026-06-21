import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { mockProjectsApi } from "../../test/mockApi";

function renderApp(path = "/app/overview") {
  window.history.pushState({}, "", path);
  return render(<App />);
}

describe("Mobile navigation drawer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("offers a labeled menu trigger", async () => {
    mockProjectsApi({ list: [] });
    renderApp();
    expect(await screen.findByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });

  it("opens a navigation dialog when the trigger is used", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Open navigation menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Navigation" });
    expect(within(dialog).getByRole("link", { name: "Projects" })).toBeInTheDocument();
  });

  it("closes via its close control", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Open navigation menu" }));
    await user.click(screen.getByRole("button", { name: "Close navigation menu" }));
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Open navigation menu" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });

  it("closes when a destination is chosen", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Open navigation menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Navigation" });
    await user.click(within(dialog).getByRole("link", { name: "Projects" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
  });

  it("restores focus to the trigger after closing", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    renderApp();

    const trigger = await screen.findByRole("button", { name: "Open navigation menu" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
