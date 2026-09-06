import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProjectSectionId } from "../utils/projectCommandCenter";
import { ProjectOperationsMap, type ProjectOperationsMapSignals } from "./ProjectOperationsMap";

function summary(
  targetId: ProjectSectionId,
  label: string,
  title: string,
  detail: string,
  tone: "neutral" | "info" | "success" | "warning" | "danger" = "success",
) {
  return { state: label.toLowerCase().replaceAll(" ", "_"), label, title, detail, tone, targetId };
}

const signals: ProjectOperationsMapSignals = {
  repository: summary("repository", "Connected", "openai/codex", "GitHub repository connected."),
  codemap: { ...summary("codemap", "Completed", "Latest analysis stored", "Analysis completed."), metric: "42 files" },
  health: {
    ...summary("health", "Healthy", "Healthy latest result", "HTTP 200"),
    metric: "184 ms",
    timestamp: "2026-03-04T11:30:00Z",
  },
  readiness: {
    ...summary("readiness", "Needs work", "Needs work readiness", "4 passed, 2 failed.", "warning"),
    scoreLabel: "44/100",
  },
  launchDecision: summary(
    "launch-decision",
    "No-go recorded",
    "Latest decision: No-go",
    "Hold launch until CI is configured.",
    "danger",
  ),
  artifacts: summary("artifacts", "1 active", "1 active artifact", "Most recent: Deployment runbook", "info"),
  activity: summary("activity", "2 events", "Latest activity", "Artifact was created.", "info"),
};

describe("ProjectOperationsMap", () => {
  it("renders the evidence topology and starts with repository details selected", () => {
    render(<ProjectOperationsMap signals={signals} />);

    expect(screen.getByRole("heading", { name: "Operational evidence" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project evidence flow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inspect Repository: Connected" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const inspector = screen.getByRole("complementary", { name: "Selected project signal" });
    expect(within(inspector).getByText("openai/codex")).toBeInTheDocument();
    expect(within(inspector).getByText("GitHub repository connected.")).toBeInTheDocument();
    expect(within(inspector).getByRole("link", { name: "Open Repository" })).toHaveAttribute("href", "#repository");
  });

  it("reveals the selected signal reading and navigates to its existing detail section", async () => {
    const user = userEvent.setup();
    render(<ProjectOperationsMap signals={signals} />);

    await user.click(screen.getByRole("button", { name: "Inspect Production health: Healthy" }));

    const inspector = screen.getByRole("complementary", { name: "Selected project signal" });
    expect(within(inspector).getByText("Healthy latest result")).toBeInTheDocument();
    expect(within(inspector).getByText("HTTP 200")).toBeInTheDocument();
    expect(within(inspector).getByText("184 ms")).toBeInTheDocument();
    expect(within(inspector).getByRole("link", { name: "Open Production health" })).toHaveAttribute("href", "#health");
  });

  it("keeps artifacts and activity available as supporting evidence", async () => {
    const user = userEvent.setup();
    render(<ProjectOperationsMap signals={signals} />);

    await user.click(screen.getByRole("button", { name: "Inspect Artifacts: 1 active" }));

    const inspector = screen.getByRole("complementary", { name: "Selected project signal" });
    expect(within(inspector).getByText("1 active artifact")).toBeInTheDocument();
    expect(within(inspector).getByText("Most recent: Deployment runbook")).toBeInTheDocument();
    expect(within(inspector).getByRole("link", { name: "Open Artifacts" })).toHaveAttribute("href", "#artifacts");
  });
});
