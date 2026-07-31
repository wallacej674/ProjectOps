import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectActivityTimeline } from "./ProjectActivityTimeline";
import type { ProjectActivityEvent } from "../../../types/projectActivity";

const events: ProjectActivityEvent[] = [
  {
    id: 2,
    project_id: 7,
    event_type: "artifact_created",
    event_category: "artifact",
    message: "Artifact was created.",
    related_resource_type: "project_artifact",
    related_resource_id: 12,
    metadata: { title: "Deployment runbook", artifact_type: "runbook" },
    created_at: "2026-01-03T12:00:00Z",
  },
  {
    id: 1,
    project_id: 7,
    event_type: "project_created",
    event_category: "project",
    message: "Project was created.",
    related_resource_type: "project",
    related_resource_id: 7,
    metadata: { name: "CivicPermit API" },
    created_at: "2026-01-01T12:00:00Z",
  },
];

describe("ProjectActivityTimeline", () => {
  it("shows a loading state", () => {
    render(
      <ProjectActivityTimeline
        events={[]}
        loading
        error=""
        categoryFilter=""
        onCategoryFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "Recent Activity" })).toBeInTheDocument();
    expect(screen.getByText("Loading recent activity...")).toBeInTheDocument();
  });

  it("shows an empty state without fake events", () => {
    render(
      <ProjectActivityTimeline
        events={[]}
        loading={false}
        error=""
        categoryFilter=""
        onCategoryFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
    expect(screen.getByText(/ProjectOps will record activity/)).toBeInTheDocument();
    expect(screen.queryByText("Artifact was created.")).not.toBeInTheDocument();
  });

  it("shows an error state without hiding the section", () => {
    render(
      <ProjectActivityTimeline
        events={[]}
        loading={false}
        error="Activity could not load."
        categoryFilter=""
        onCategoryFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "Recent Activity" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Activity could not load.");
  });

  it("renders activity events with category labels, timestamps, resource details, and metadata", () => {
    render(
      <ProjectActivityTimeline
        events={events}
        loading={false}
        error=""
        categoryFilter=""
        onCategoryFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: "Recent activity events" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Artifact");
    expect(items[0]).toHaveTextContent("Artifact was created.");
    expect(items[0]).toHaveTextContent("Jan 3, 2026");
    expect(items[0]).toHaveTextContent("project_artifact #12");
    expect(items[0]).toHaveTextContent("Deployment runbook");
    expect(items[1]).toHaveTextContent("Project was created.");
  });

  it("changes and clears the category filter", async () => {
    const user = userEvent.setup();
    const onCategoryFilterChange = vi.fn();
    const onClearFilters = vi.fn();
    render(
      <ProjectActivityTimeline
        events={events}
        loading={false}
        error=""
        categoryFilter="artifact"
        onCategoryFilterChange={onCategoryFilterChange}
        onClearFilters={onClearFilters}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Filter activity by category"), "health");
    await user.click(screen.getByRole("button", { name: "Clear activity filters" }));

    expect(onCategoryFilterChange).toHaveBeenCalledWith("health");
    expect(onClearFilters).toHaveBeenCalled();
    expect(screen.getByText("Filters active")).toBeInTheDocument();
  });

  it("refreshes activity without clearing the active category filter", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(
      <ProjectActivityTimeline
        events={events}
        loading={false}
        error=""
        categoryFilter="artifact"
        onCategoryFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
        onRefresh={onRefresh}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Refresh activity" }));

    expect(onRefresh).toHaveBeenCalled();
    expect(screen.getByDisplayValue("Artifacts")).toBeInTheDocument();
  });

  it("shows a no-results state when filters match nothing", () => {
    render(
      <ProjectActivityTimeline
        events={[]}
        loading={false}
        error=""
        categoryFilter="health"
        onCategoryFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByText("No activity matches these filters.")).toBeInTheDocument();
  });
});
