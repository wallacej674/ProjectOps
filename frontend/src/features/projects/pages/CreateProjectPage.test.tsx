import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app/App";
import { json, makeProject, mockFetch, mockProjectsApi, validationError } from "../../../test/mockApi";

function renderCreate() {
  window.history.pushState({}, "", "/app/projects/new");
  return render(<App />);
}

describe("Create Project flow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires a Project name before submitting", async () => {
    const fetchMock = mockProjectsApi();
    const user = userEvent.setup();
    renderCreate();

    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByText("Enter a Project name.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Project" })).toBeInTheDocument();
    // No POST was attempted.
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  });

  it("submits and navigates to the new Project's detail page", async () => {
    const billing = makeProject({ id: 12, name: "Billing Service" });
    mockProjectsApi({ create: billing, get: billing });
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Project name"), "Billing Service");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByRole("heading", { name: "Billing Service" })).toBeInTheDocument();
    expect(screen.getByText("Setup progress")).toBeInTheDocument();
  });

  it("surfaces a backend validation error without leaving the form", async () => {
    mockProjectsApi({ create: validationError("A Project with this name already exists.") });
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Project name"), "Duplicate");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A Project with this name already exists.");
    expect(screen.getByRole("heading", { name: "Create Project" })).toBeInTheDocument();
  });

  it("surfaces a generic backend failure", async () => {
    mockProjectsApi({ create: json({ detail: "Internal Server Error" }, 500) });
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Project name"), "Anything");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal Server Error");
  });

  it("shows a pending state while the request is in flight", async () => {
    let resolveCreate!: (r: Response) => void;
    const inflight = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const billing = makeProject({ id: 12, name: "Billing Service" });
    mockFetch((_url, init) => ((init.method ?? "GET") === "POST" ? inflight : json(billing)));
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Project name"), "Billing Service");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    const saving = await screen.findByRole("button", { name: "Saving" });
    expect(saving).toBeDisabled();

    resolveCreate(json(makeProject({ id: 12, name: "Billing Service" })));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Billing Service" })).toBeInTheDocument());
  });

  it("cancels back to the previous page without saving", async () => {
    const fetchMock = mockProjectsApi({ list: [] });
    const user = userEvent.setup();
    window.history.pushState({}, "", "/app/projects");
    window.history.pushState({}, "", "/app/projects/new");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  });
});
