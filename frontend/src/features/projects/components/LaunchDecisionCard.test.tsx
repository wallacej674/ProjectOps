import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProjectArtifact } from "../../../types/projectArtifact";
import { LaunchDecisionCard } from "./LaunchDecisionCard";

const baseDecision: ProjectArtifact = {
  id: 42,
  project_id: 7,
  created_by_user_id: 3,
  created_by_user: {
    id: 3,
    email: "reviewer@example.com",
    display_name: "Release Reviewer",
  },
  title: "Launch decision: No-go",
  artifact_type: "decision",
  source_type: "manual",
  url: null,
  content: "Decision: no-go\n\nNotes:\nHold launch until CI is configured.",
  summary: "Hold launch until CI is configured.",
  tags: "launch-decision,go-no-go,no-go",
  status: "active",
  created_at: "2026-01-08T12:00:00Z",
  updated_at: "2026-01-08T12:00:00Z",
};

describe("LaunchDecisionCard", () => {
  it("renders the latest human decision and newest-first decision history", () => {
    render(
      <LaunchDecisionCard
        decisionHistory={[
          baseDecision,
          {
            ...baseDecision,
            id: 41,
            title: "Launch decision: Go",
            content: "Decision: go\n\nNotes:\nRelease owner accepted the launch window.",
            summary: "Release owner accepted the launch window.",
            tags: "launch-decision,go-no-go,go",
            created_at: "2026-01-07T12:00:00Z",
            updated_at: "2026-01-07T12:00:00Z",
            created_by_user_id: null,
            created_by_user: null,
          },
        ]}
        loading={false}
        error=""
        pending={false}
        onRecord={vi.fn()}
      />,
    );

    const decision = screen.getByRole("region", { name: "Launch Decision" });
    expect(within(decision).getByText("Human launch decision")).toBeInTheDocument();
    expect(within(decision).getAllByText("No-go").length).toBeGreaterThan(0);
    expect(within(decision).getAllByText("Hold launch until CI is configured.").length).toBeGreaterThan(0);
    expect(within(decision).getAllByText(/Recorded Jan 8, 2026/).length).toBeGreaterThan(0);
    expect(within(decision).getAllByText("Recorded by Release Reviewer").length).toBeGreaterThan(0);
    expect(within(decision).getByText("Recorder unavailable for this historical record.")).toBeInTheDocument();
    expect(
      within(decision).getByText(
        "ProjectOps provides advisory signals; the final decision is human-recorded and stored as a Project Artifact.",
      ),
    ).toBeInTheDocument();

    const historyItems = within(decision).getAllByRole("listitem");
    expect(historyItems).toHaveLength(2);
    expect(within(historyItems[0]).getByText("No-go")).toBeInTheDocument();
    expect(within(historyItems[1]).getByText("Go")).toBeInTheDocument();
    expect(within(historyItems[1]).getByText("Release owner accepted the launch window.")).toBeInTheDocument();
    expect(within(historyItems[0]).getByRole("link", { name: "View in Project Artifacts" })).toHaveAttribute(
      "href",
      "#artifacts",
    );
  });

  it("renders a clear no-history state", () => {
    render(
      <LaunchDecisionCard decisionHistory={[]} loading={false} error="" pending={false} onRecord={vi.fn()} />,
    );

    const decision = screen.getByRole("region", { name: "Launch Decision" });
    expect(within(decision).getByText("No launch decision has been recorded yet.")).toBeInTheDocument();
    expect(within(decision).getByText("Decision history is empty.")).toBeInTheDocument();
  });

  it("requires notes for No-go and Defer decisions", async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();
    render(<LaunchDecisionCard decisionHistory={[]} loading={false} error="" pending={false} onRecord={onRecord} />);

    const decision = screen.getByRole("region", { name: "Launch Decision" });
    const notes = within(decision).getByLabelText("Decision notes");

    await user.click(within(decision).getByRole("button", { name: "Record Launch Decision" }));
    expect(within(decision).getByRole("alert")).toHaveTextContent("Defer decisions require notes.");
    expect(notes).toHaveAttribute("aria-invalid", "true");
    expect(onRecord).not.toHaveBeenCalled();

    await user.selectOptions(within(decision).getByLabelText("Decision"), "no_go");
    await user.click(within(decision).getByRole("button", { name: "Record Launch Decision" }));
    expect(within(decision).getByRole("alert")).toHaveTextContent("No-go decisions require notes.");
    expect(onRecord).not.toHaveBeenCalled();
  });

  it("allows Go with optional notes and submits the selected value", async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn().mockResolvedValue(undefined);
    render(<LaunchDecisionCard decisionHistory={[]} loading={false} error="" pending={false} onRecord={onRecord} />);

    const decision = screen.getByRole("region", { name: "Launch Decision" });
    await user.selectOptions(within(decision).getByLabelText("Decision"), "go");
    await user.click(within(decision).getByRole("button", { name: "Record Launch Decision" }));

    expect(onRecord).toHaveBeenCalledWith("go", "");
    expect(within(decision).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows pending and failed save states accessibly", async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn().mockRejectedValue(new Error("Launch decision could not be recorded."));
    const { rerender } = render(
      <LaunchDecisionCard decisionHistory={[]} loading={false} error="" pending={true} onRecord={onRecord} />,
    );

    const decision = screen.getByRole("region", { name: "Launch Decision" });
    expect(within(decision).getByRole("button", { name: "Recording launch decision" })).toBeDisabled();
    expect(within(decision).getByLabelText("Decision")).toBeDisabled();
    expect(within(decision).getByLabelText("Decision notes")).toBeDisabled();

    rerender(<LaunchDecisionCard decisionHistory={[]} loading={false} error="" pending={false} onRecord={onRecord} />);
    const activeDecision = screen.getByRole("region", { name: "Launch Decision" });
    await user.selectOptions(within(activeDecision).getByLabelText("Decision"), "go");
    await user.click(within(activeDecision).getByRole("button", { name: "Record Launch Decision" }));

    expect(await within(activeDecision).findByRole("alert")).toHaveTextContent("Launch decision could not be recorded.");
  });
});
