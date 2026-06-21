import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch, mockProjectsApi } from "../../../test/mockApi";

const project = makeProject({ id: 7, name: "CivicPermit API", status: "development" });

function renderRegistry() {
  window.history.pushState({}, "", "/app/projects");
  return render(<App />);
}

async function openArchive(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Archive CivicPermit API" }));
  return screen.getByRole("dialog");
}

describe("Archive Project flow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens a confirmation that names the Project", async () => {
    mockProjectsApi({ list: [project] });
    const user = userEvent.setup();
    renderRegistry();

    const dialog = await openArchive(user);
    expect(within(dialog).getByRole("heading", { name: "Archive CivicPermit API?" })).toBeInTheDocument();
  });

  it("moves focus to the Cancel control when it opens", async () => {
    mockProjectsApi({ list: [project] });
    const user = userEvent.setup();
    renderRegistry();

    await openArchive(user);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes on Cancel without archiving", async () => {
    const fetchMock = mockProjectsApi({ list: [project] });
    const user = userEvent.setup();
    renderRegistry();

    await openArchive(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => (init?.method ?? "GET") === "DELETE")).toBe(false);
  });

  it("closes on Escape", async () => {
    mockProjectsApi({ list: [project] });
    const user = userEvent.setup();
    renderRegistry();

    await openArchive(user);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a pending state while archiving", async () => {
    let resolveDelete!: (r: Response) => void;
    const inflight = new Promise<Response>((resolve) => {
      resolveDelete = resolve;
    });
    mockFetch((_url, init) =>
      (init.method ?? "GET") === "DELETE" ? inflight : json([project]),
    );
    const user = userEvent.setup();
    renderRegistry();

    await openArchive(user);
    await user.click(screen.getByRole("button", { name: "Archive Project" }));

    const archiving = await screen.findByRole("button", { name: "Archiving" });
    expect(archiving).toBeDisabled();
    resolveDelete(json(makeProject({ status: "archived" })));
  });

  it("archives, clears the modal, and removes the Project from the active list", async () => {
    let archived = false;
    mockFetch((url, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (method === "DELETE") {
        archived = true;
        return json(makeProject({ status: "archived" }));
      }
      return json(archived ? [] : [project]);
    });
    const user = userEvent.setup();
    renderRegistry();

    await openArchive(user);
    await user.click(screen.getByRole("button", { name: "Archive Project" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText("CivicPermit API")).not.toBeInTheDocument());
  });

  it("keeps the modal open and shows an error when archiving fails", async () => {
    mockProjectsApi({ list: [project], archive: json({ detail: "Project could not be archived." }, 500) });
    const user = userEvent.setup();
    renderRegistry();

    await openArchive(user);
    await user.click(screen.getByRole("button", { name: "Archive Project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Project could not be archived.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows archived Projects only when archived records are included", async () => {
    const archivedProject = makeProject({ id: 9, name: "Legacy Portal", status: "archived" });
    mockFetch((url) =>
      url.includes("include_archived=true") ? json([archivedProject]) : json([]),
    );
    const user = userEvent.setup();
    renderRegistry();

    expect(await screen.findByRole("heading", { name: "No Projects yet" })).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Include archived/));
    expect(await screen.findByText("Legacy Portal")).toBeInTheDocument();
  });
});
