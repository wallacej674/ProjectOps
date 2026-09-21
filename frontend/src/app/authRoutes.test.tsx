import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { json, makeProject, mockProjectsApi, signInTestUser } from "../test/mockApi";

function go(path: string) {
  window.history.pushState({}, "", path);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("auth routes", () => {
  it("redirects unauthenticated app routes to login", async () => {
    vi.stubGlobal("fetch", vi.fn());
    go("/app/overview");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in to ProjectOps" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("lets an authenticated user access overview and see their account", async () => {
    const user = userEvent.setup();
    signInTestUser();
    mockProjectsApi({ list: [makeProject()] });
    go("/app/overview");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("engineer@example.com")).toBeInTheDocument();
  });

  it("redirects login to the intended route after sign in", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes("/api/v1/auth/login")) {
          return json({
            access_token: "login-token",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: 1, email: "engineer@example.com", display_name: null, status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
          });
        }
        if (url.includes("/api/v1/projects")) return json([makeProject()]);
        if (url.includes("/api/v1/activity")) return json([]);
        if (url.includes("/api/v1/demo-data/status")) return json({ enabled: true, reason: null });
        return json({});
      }),
    );
    go("/login?redirect=/app/projects");
    render(<App />);

    await user.type(screen.getByLabelText("Email"), "engineer@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/projects");
  });

  it("logs out and returns to login", async () => {
    signInTestUser();
    mockProjectsApi({ list: [makeProject()] });
    const user = userEvent.setup();
    go("/app/projects");
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Sign in to ProjectOps" })).toBeInTheDocument();
    expect(localStorage.getItem("projectops.auth.token")).toBeNull();
  });

  it("redirects authenticated users away from register", async () => {
    signInTestUser();
    mockProjectsApi({ list: [makeProject()] });
    go("/register");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/overview");
  });
});

it("submits a masked beta invitation code and displays admission errors", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async () => json({ detail: "Registration is unavailable or the invitation code is invalid." }, 403));
  vi.stubGlobal("fetch", fetchMock);
  go("/register");
  render(<App />);
  const invitation = screen.getByLabelText("Beta invitation code");
  expect(invitation).toHaveAttribute("type", "password");
  await user.type(screen.getByLabelText("Email"), "beta@example.com");
  await user.type(screen.getByLabelText("Password"), "synthetic-password");
  await user.type(invitation, "synthetic-beta-code");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("invitation code is invalid");
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/register"), expect.objectContaining({
    body: JSON.stringify({ email: "beta@example.com", password: "synthetic-password", display_name: "", invitation_code: "synthetic-beta-code" }),
  }));
  expect(localStorage.getItem("projectops.auth.token")).toBeNull();
});
