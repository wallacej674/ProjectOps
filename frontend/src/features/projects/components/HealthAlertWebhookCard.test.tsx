import { render, screen, fireEvent } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import { HealthAlertWebhookCard } from "./HealthAlertWebhookCard";
import type { ProjectAlertWebhook } from "../../../types/projectAlertWebhook";

function renderCard(overrides: Partial<Parameters<typeof HealthAlertWebhookCard>[0]> = {}) {
  const onSave = vi.fn();
  const onPause = vi.fn();
  const onSendTest = vi.fn();
  render(
    <HealthAlertWebhookCard
      webhook={null}
      loading={false}
      error=""
      pending={false}
      testPending={false}
      testResult={null}
      testError=""
      onSave={onSave}
      onPause={onPause}
      onSendTest={onSendTest}
      {...overrides}
    />,
  );
  return { onSave, onPause, onSendTest };
}

const enabledWebhook: ProjectAlertWebhook = {
  project_id: 1, enabled: true, url: "https://hooks.slack.com/services/T000/B000/XXXX",
  last_delivery_attempted_at: null, last_delivery_transition: null, last_delivery_outcome: null,
  last_delivery_http_status: null, last_delivery_error: null, created_at: "2026-09-22T00:00:00Z", updated_at: "2026-09-22T00:00:00Z",
};

test("entering a URL in an unconfigured webhook and saving calls onSave with that URL", () => {
  const { onSave } = renderCard();

  fireEvent.click(screen.getByRole("button", { name: "Configure webhook" }));
  fireEvent.change(screen.getByLabelText("Webhook URL"), { target: { value: "https://hooks.slack.com/services/T1/B1/X1" } });
  fireEvent.click(screen.getByRole("button", { name: "Enable alert delivery" }));

  expect(onSave).toHaveBeenCalledWith("https://hooks.slack.com/services/T1/B1/X1");
});

test("an enabled webhook shows the saved URL, a pause button, and a send-test button", () => {
  const { onPause, onSendTest } = renderCard({ webhook: enabledWebhook });

  fireEvent.click(screen.getByRole("button", { name: "Configure webhook" }));
  expect(screen.getByLabelText("Webhook URL")).toHaveValue(enabledWebhook.url);

  fireEvent.click(screen.getByRole("button", { name: "Pause alert delivery" }));
  expect(onPause).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Send test notification" }));
  expect(onSendTest).toHaveBeenCalled();
});

test("cancel reverts the input to the saved URL without calling any handler", () => {
  const { onSave } = renderCard({ webhook: enabledWebhook });

  fireEvent.click(screen.getByRole("button", { name: "Configure webhook" }));
  fireEvent.change(screen.getByLabelText("Webhook URL"), { target: { value: "https://example.com/changed" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  fireEvent.click(screen.getByRole("button", { name: "Configure webhook" }));
  expect(screen.getByLabelText("Webhook URL")).toHaveValue(enabledWebhook.url);
  expect(onSave).not.toHaveBeenCalled();
});

test("a failed last delivery renders the error text as an alert", () => {
  renderCard({
    webhook: { ...enabledWebhook, last_delivery_attempted_at: "2026-09-22T00:00:00Z", last_delivery_transition: "opened",
      last_delivery_outcome: "failed", last_delivery_http_status: 500, last_delivery_error: "Webhook endpoint returned HTTP 500." },
  });

  expect(screen.getByRole("alert")).toHaveTextContent("Webhook endpoint returned HTTP 500.");
});

test("a delivered last delivery renders a plain summary with no error text", () => {
  renderCard({
    webhook: { ...enabledWebhook, last_delivery_attempted_at: "2026-09-22T00:00:00Z", last_delivery_transition: "opened",
      last_delivery_outcome: "delivered", last_delivery_http_status: 200, last_delivery_error: null },
  });

  expect(screen.getByText(/Last delivery: delivered \(opened\)/)).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("send-test pending and result states render inline feedback", () => {
  const { rerender } = render(
    <HealthAlertWebhookCard
      webhook={enabledWebhook}
      loading={false}
      error=""
      pending={false}
      testPending={true}
      testResult={null}
      testError=""
      onSave={vi.fn()}
      onPause={vi.fn()}
      onSendTest={vi.fn()}
    />,
  );
  expect(screen.getByText("Sending test notification...")).toBeInTheDocument();

  rerender(
    <HealthAlertWebhookCard
      webhook={enabledWebhook}
      loading={false}
      error=""
      pending={false}
      testPending={false}
      testResult={{ ...enabledWebhook, last_delivery_outcome: "delivered", last_delivery_http_status: 200 }}
      testError=""
      onSave={vi.fn()}
      onPause={vi.fn()}
      onSendTest={vi.fn()}
    />,
  );
  expect(screen.getByText(/Test delivered/)).toBeInTheDocument();
});
