import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch, mockProjectsApi } from "../../../test/mockApi";

function renderEdit(path = "/app/projects/7/edit") {
  window.history.pushState({}, "", path);
  return render(<App />);
}

const fullProject = makeProject({
  id: 7,
  name: "CivicPermit API",
  description: "Permit workflow service",
  repo_url: "https://github.com/acme/permit",
  production_url: "https://permit.example.com",
  status: "staging",
});

describe("Edit Project flow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a loading state before the Project resolves", async () => {
    mockProjectsApi({ get: fullProject });
    const { container } = renderEdit();

    expect(container.querySelector(".skeleton")).toBeInTheDocument();
    expect(await screen.findByLabelText("Project name")).toBeInTheDocument();
  });

  it("prepopulates every field with the existing Project values", async () => {
    mockProjectsApi({ get: fullProject });
    renderEdit();

    expect(await screen.findByRole("heading", { name: "Edit CivicPermit API" })).toBeInTheDocument();
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("CivicPermit API");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toBe("Permit workflow service");
    expect((screen.getByLabelText(/Repository URL/) as HTMLInputElement).value).toBe("https://github.com/acme/permit");
    expect((screen.getByLabelText(/Production URL/) as HTMLInputElement).value).toBe("https://permit.example.com");
    expect((screen.getByLabelText("Project status") as HTMLSelectElement).value).toBe("staging");
  });

  it("shows an error when the Project is missing", async () => {
    mockProjectsApi({ get: "not-found" });
    renderEdit();

    expect(await screen.findByRole("heading", { name: "Project unavailable" })).toBeInTheDocument();
  });

  it("saves changes and navigates to the Project detail page", async () => {
    mockProjectsApi({ get: fullProject, update: { ...fullProject, name: "CivicPermit API v2" } });
    const user = userEvent.setup();
    renderEdit();

    const name = await screen.findByLabelText("Project name");
    await user.clear(name);
    await user.type(name, "CivicPermit API v2");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // Lands back on the detail dashboard.
    expect(await screen.findByText("Setup progress")).toBeInTheDocument();
  });

  it("surfaces a backend failure on save", async () => {
    mockProjectsApi({ get: fullProject, update: json({ detail: "Could not save changes." }, 500) });
    const user = userEvent.setup();
    renderEdit();

    await user.click(await screen.findByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save changes.");
    expect(screen.getByRole("heading", { name: "Edit CivicPermit API" })).toBeInTheDocument();
  });

  it("cancels back to the previous page without saving", async () => {
    const fetchMock = mockFetch((url, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.match(/projects\/7(\?|$)/) && method === "GET") return json(fullProject);
      return json([]); // list
    });
    const user = userEvent.setup();
    window.history.pushState({}, "", "/app/projects");
    window.history.pushState({}, "", "/app/projects/7/edit");
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => (init?.method ?? "GET") === "PATCH")).toBe(false);
  });
});
