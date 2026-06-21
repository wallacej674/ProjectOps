import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { makeProject, mockProjectsApi } from "../../../test/mockApi";

const alpha = makeProject({ id: 1, name: "Alpha", updated_at: "2026-03-01T00:00:00Z" });
const mango = makeProject({ id: 2, name: "Mango", updated_at: "2026-02-01T00:00:00Z" });
const zeta = makeProject({ id: 3, name: "Zeta", updated_at: "2026-01-01T00:00:00Z" });

function renderRegistry() {
  window.history.pushState({}, "", "/app/projects");
  return render(<App />);
}

/** Order of Project card headings currently shown. */
function cardOrder() {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent)
    .filter((t): t is string => Boolean(t));
}

describe("Project sorting", () => {
  afterEach(() => vi.restoreAllMocks());

  it("defaults to most recently updated first", async () => {
    mockProjectsApi({ list: [zeta, alpha, mango] });
    renderRegistry();
    await screen.findByText("Alpha");
    expect(cardOrder()).toEqual(["Alpha", "Mango", "Zeta"]);
  });

  it("sorts by name ascending and descending", async () => {
    mockProjectsApi({ list: [zeta, alpha, mango] });
    const user = userEvent.setup();
    renderRegistry();
    await screen.findByText("Alpha");

    await user.selectOptions(screen.getByLabelText("Sort Projects"), "name-desc");
    expect(cardOrder()).toEqual(["Zeta", "Mango", "Alpha"]);

    await user.selectOptions(screen.getByLabelText("Sort Projects"), "name-asc");
    expect(cardOrder()).toEqual(["Alpha", "Mango", "Zeta"]);
  });

  it("sorts oldest updated first", async () => {
    mockProjectsApi({ list: [zeta, alpha, mango] });
    const user = userEvent.setup();
    renderRegistry();
    await screen.findByText("Alpha");

    await user.selectOptions(screen.getByLabelText("Sort Projects"), "updated-asc");
    expect(cardOrder()).toEqual(["Zeta", "Mango", "Alpha"]);
  });

  it("applies sorting after a search filter", async () => {
    // Null descriptions so the search only matches names.
    const list = [zeta, alpha, mango].map((p) => ({ ...p, description: null }));
    const apex = makeProject({ id: 4, name: "Apex Service", updated_at: "2026-04-01T00:00:00Z", description: null });
    mockProjectsApi({ list: [...list, apex] });
    const user = userEvent.setup();
    renderRegistry();
    await screen.findByText("Alpha");

    await user.type(screen.getByLabelText("Search Projects"), "p");
    await user.selectOptions(screen.getByLabelText("Sort Projects"), "name-desc");
    // Only "Alpha" and "Apex Service" contain "p"; descending puts Apex first.
    expect(cardOrder()).toEqual(["Apex Service", "Alpha"]);
  });

  it("keeps sort order when switching to the table view", async () => {
    mockProjectsApi({ list: [zeta, alpha, mango] });
    const user = userEvent.setup();
    renderRegistry();
    await screen.findByText("Alpha");

    await user.selectOptions(screen.getByLabelText("Sort Projects"), "name-desc");
    await user.click(screen.getByRole("button", { name: "Table" }));

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1); // drop header
    const names = rows.map((r) => within(r).getAllByRole("cell")[0].querySelector("strong")?.textContent);
    expect(names).toEqual(["Zeta", "Mango", "Alpha"]);
  });
});
