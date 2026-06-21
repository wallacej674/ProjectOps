/**
 * Characterization tests: lock the CURRENT behavior of the app across routes
 * before the Milestone 9 refactor moves these components into feature modules.
 * They must keep passing unchanged after the refactor.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { makeProject, mockProjectsApi } from "../test/mockApi";

function go(path: string) {
  window.history.pushState({}, "", path);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => vi.restoreAllMocks());

describe("characterization: routes and flows", () => {
  it("Overview shows project metrics from the list endpoint", async () => {
    mockProjectsApi({ list: [makeProject(), makeProject({ id: 8, name: "Second", status: "archived" })] });
    go("/app/overview");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /understand what needs attention/i }),
    ).toBeInTheDocument();
    const active = screen.getByText("Active projects").closest(".metric")!;
    expect(within(active as HTMLElement).getByText("1")).toBeInTheDocument();
  });

  it("Projects list renders cards and supports the table view", async () => {
    mockProjectsApi({ list: [makeProject()] });
    const user = userEvent.setup();
    go("/app/projects");
    render(<App />);

    expect(await screen.findByText("CivicPermit API")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("Create form blocks an empty name and stays on the page", async () => {
    mockProjectsApi();
    const user = userEvent.setup();
    go("/app/projects/new");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create Project" }));
    expect(await screen.findByText("Enter a Project name.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Project" })).toBeInTheDocument();
  });

  it("Create success navigates to the new Project's detail page", async () => {
    mockProjectsApi({ create: makeProject({ id: 7, name: "CivicPermit API" }) });
    const user = userEvent.setup();
    go("/app/projects/new");
    render(<App />);

    await user.type(screen.getByLabelText("Project name"), "CivicPermit API");
    await user.click(screen.getByRole("button", { name: "Create Project" }));
    expect(await screen.findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    expect(screen.getByText("Setup progress")).toBeInTheDocument();
  });

  it("Edit form prepopulates with existing Project values", async () => {
    mockProjectsApi({ get: makeProject({ name: "CivicPermit API" }) });
    go("/app/projects/7/edit");
    render(<App />);

    const name = (await screen.findByLabelText("Project name")) as HTMLInputElement;
    expect(name.value).toBe("CivicPermit API");
  });

  it("Detail page renders the Project and setup progress", async () => {
    mockProjectsApi({ get: makeProject({ name: "CivicPermit API" }) });
    go("/app/projects/7");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "CivicPermit API" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project information" })).toBeInTheDocument();
  });

  it("Archive control opens a confirmation naming the Project", async () => {
    mockProjectsApi({ list: [makeProject({ name: "CivicPermit API" })] });
    const user = userEvent.setup();
    go("/app/projects");
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Archive CivicPermit API" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archive CivicPermit API?" })).toBeInTheDocument();
  });

  it("Theme control toggles the document theme and its label", async () => {
    mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    go("/app/overview");
    render(<App />);

    const toggle = await screen.findByRole("button", { name: /switch to light theme/i });
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
  });
});
