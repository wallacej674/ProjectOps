import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, test, expect } from "vitest";
import { StatusPageCard } from "./StatusPageCard";

function renderCard(overrides: Partial<Parameters<typeof StatusPageCard>[0]> = {}) {
  const onEnable = vi.fn();
  const onPause = vi.fn();
  const onRotateSlug = vi.fn();
  render(
    <MemoryRouter>
      <StatusPageCard
        projectId={1}
        page={null}
        loading={false}
        error=""
        pending={false}
        productionUrl="https://launchbudget.example.com"
        onEnable={onEnable}
        onPause={onPause}
        onRotateSlug={onRotateSlug}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { onEnable, onPause, onRotateSlug };
}

test("prompts for a production URL before a status page can be published", () => {
  renderCard({ productionUrl: null });

  expect(screen.getByText("Add a production URL before publishing a status page.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Publish status page" })).not.toBeInTheDocument();
});

test("publishing an unpublished page calls onEnable with the entered label", () => {
  const { onEnable } = renderCard({ page: { project_id: 1, enabled: false, slug: null, label: null, created_at: null, updated_at: null } });

  fireEvent.change(screen.getByLabelText("Public display name"), { target: { value: "LaunchBudget Status" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish status page" }));

  expect(onEnable).toHaveBeenCalledWith("LaunchBudget Status");
});

test("shows the public link and lets an owner unpublish or rotate it once enabled", () => {
  const { onPause, onRotateSlug } = renderCard({
    page: { project_id: 1, enabled: true, slug: "abc123", label: "LaunchBudget", created_at: "2026-09-22T00:00:00Z", updated_at: "2026-09-22T00:00:00Z" },
  });

  expect(screen.getByText("Published")).toBeInTheDocument();
  expect(screen.getAllByText(/\/status\/abc123/).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: "Unpublish status page" }));
  expect(onPause).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Rotate link" }));
  expect(onRotateSlug).toHaveBeenCalled();
});

test("shows a copyable badge embed once published", () => {
  renderCard({
    page: { project_id: 1, enabled: true, slug: "abc123", label: "LaunchBudget", created_at: "2026-09-22T00:00:00Z", updated_at: "2026-09-22T00:00:00Z" },
  });

  expect(screen.getByAltText("Status badge for LaunchBudget")).toBeInTheDocument();
  expect(screen.getByText(/badge\.svg/)).toBeInTheDocument();
});

test("does not show a badge embed for an unpublished page", () => {
  renderCard({
    page: { project_id: 1, enabled: false, slug: "abc123", label: "LaunchBudget", created_at: "2026-09-22T00:00:00Z", updated_at: "2026-09-22T00:00:00Z" },
  });

  expect(screen.queryByText(/badge\.svg/)).not.toBeInTheDocument();
});
