import { render, screen, fireEvent } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import { HealthAlertsPanel } from "./HealthAlertsPanel";

const active = { id: 7, project_id: 1, status: "active", target_url: "https://example.com", failure_count: 2,
  first_failure_at: "2026-09-01T00:00:00Z", opened_at: "2026-09-01T00:15:00Z", last_observed_at: "2026-09-01T00:15:00Z",
  acknowledged_at: null, acknowledged_by_user_id: null };

test("owner acknowledges an alert without resolving it and can inspect evidence", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const body = url.endsWith("acknowledge") ? { ...active, acknowledged_at: "2026-09-01T00:16:00Z", acknowledged_by_user_id: 1 }
      : url.includes("/7?") ? { alert: active, evidence: { items: [], total: 0 } }
      : { items: [active], total: 1 };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const onRefresh = vi.fn();
  render(<HealthAlertsPanel projectId="1" onRefresh={onRefresh} />);
  fireEvent.click(await screen.findByRole("button", { name: "Acknowledge alert" }));
  expect(await screen.findByText(/Alert acknowledged/)).toBeInTheDocument();
  expect(screen.getByText(/Scheduled checks are failing/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Inspect evidence/ }));
  expect(await screen.findByText("No supporting checks on this page.")).toBeInTheDocument();
  expect(onRefresh).toHaveBeenCalled();
  fetchMock.mockRestore();
});

// Polling is verified through the actual alert UI, including stale-data behavior.
import { act } from "@testing-library/react";

test("retains evidence on refresh failure and stops polling after unmount", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ items: [active], total: 1 }), { status: 200 }));
  try {
    let view: ReturnType<typeof render>;
    await act(async () => { view = render(<HealthAlertsPanel projectId="1" onRefresh={() => {}} />); });
    expect(screen.getByText("Scheduled checks are failing")).toBeInTheDocument();
    fetchMock.mockRejectedValue(new Error("offline"));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Displayed data may be stale");
    expect(screen.getByText("Scheduled checks are failing")).toBeInTheDocument();
    view!.unmount();
    const requests = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchMock).toHaveBeenCalledTimes(requests);
  } finally { fetchMock.mockRestore(); vi.useRealTimers(); }
});

test("does not poll while hidden and refreshes on return without overlapping requests", async () => {
  vi.useFakeTimers();
  let resolve: (response: Response) => void = () => {};
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
  const original = Object.getOwnPropertyDescriptor(document, "visibilityState");
  try {
    const view = render(<HealthAlertsPanel projectId="1" onRefresh={() => {}} />);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 })); });
    // A queued initial refresh may run after the first settles, never concurrently.
    await act(async () => { resolve(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 })); });
    const requests = fetchMock.mock.calls.length;
    fireEvent(window, new Event("focus"));
    expect(fetchMock).toHaveBeenCalledTimes(requests + 1);
    view.unmount();
  } finally {
    if (original) Object.defineProperty(document, "visibilityState", original);
    else Reflect.deleteProperty(document, "visibilityState");
    fetchMock.mockRestore(); vi.useRealTimers();
  }
});
