import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { json, makeAuthUser, mockFetch } from "../../test/mockApi";

function goSettings() {
  window.history.pushState({}, "", "/app/settings");
}

function mockSettings(opts: { patchResponse?: Response; passwordResponse?: Response } = {}) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/auth/me") && method === "PATCH") {
      return opts.patchResponse ?? json(makeAuthUser({ display_name: "New Name" }));
    }
    if (url.endsWith("/api/v1/auth/me/password") && method === "POST") {
      return opts.passwordResponse ?? json({ message: "Your password has been changed." });
    }
    return json([]);
  });
}

describe("Settings page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the signed-in user's email and current display name", async () => {
    mockSettings();
    goSettings();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Settings" });
    expect(within(page).getByLabelText("Email")).toHaveValue("engineer@example.com");
    expect(within(page).getByLabelText("Display name")).toHaveValue("");
  });

  it("saves a new display name", async () => {
    const fetchMock = mockSettings();
    goSettings();
    const user = userEvent.setup();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Settings" });
    await user.type(within(page).getByLabelText("Display name"), "New Name");
    await user.click(within(page).getByRole("button", { name: "Save profile" }));

    expect(await within(page).findByText("Profile updated.")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          (url as string).endsWith("/api/v1/auth/me") &&
          init?.method === "PATCH" &&
          init?.body === JSON.stringify({ display_name: "New Name" }),
      ),
    ).toBe(true);
  });

  it("shows an error when saving the profile fails", async () => {
    mockSettings({ patchResponse: json({ detail: "Profile could not be saved." }, 500) });
    goSettings();
    const user = userEvent.setup();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Settings" });
    await user.type(within(page).getByLabelText("Display name"), "New Name");
    await user.click(within(page).getByRole("button", { name: "Save profile" }));

    expect(await within(page).findByRole("alert")).toHaveTextContent("Profile could not be saved.");
  });

  it("changes the password with correct current password", async () => {
    const fetchMock = mockSettings();
    goSettings();
    const user = userEvent.setup();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Settings" });
    await user.type(within(page).getByLabelText("Current password"), "old-password");
    await user.type(within(page).getByLabelText("New password"), "a new stronger password");
    await user.click(within(page).getByRole("button", { name: "Change password" }));

    expect(await within(page).findByText("Your password has been changed.")).toBeInTheDocument();
    expect(within(page).getByLabelText("Current password")).toHaveValue("");
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          (url as string).endsWith("/api/v1/auth/me/password") &&
          init?.method === "POST" &&
          init?.body === JSON.stringify({ current_password: "old-password", new_password: "a new stronger password" }),
      ),
    ).toBe(true);
  });

  it("shows an error when the current password is incorrect", async () => {
    mockSettings({ passwordResponse: json({ detail: "Current password is incorrect." }, 401) });
    goSettings();
    const user = userEvent.setup();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Settings" });
    await user.type(within(page).getByLabelText("Current password"), "wrong-password");
    await user.type(within(page).getByLabelText("New password"), "a new stronger password");
    await user.click(within(page).getByRole("button", { name: "Change password" }));

    expect(await within(page).findByRole("alert")).toHaveTextContent("Current password is incorrect.");
  });
});
