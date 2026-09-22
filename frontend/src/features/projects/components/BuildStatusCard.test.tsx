import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CiPipelineRun } from "../../../types/ciPipelineRun";
import type { RepoIntegration } from "../../../types/repoIntegration";
import { BuildStatusCard } from "./BuildStatusCard";

const publicUrlRepo: RepoIntegration = {
  id: 3,
  project_id: 7,
  provider: "github",
  repo_owner: "acme",
  repo_name: "widgets",
  repo_url: "https://github.com/acme/widgets",
  default_branch: "main",
  is_connected: true,
  connection_mode: "public_url",
  github_installation_id: null,
  last_verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const githubAppRepo: RepoIntegration = { ...publicUrlRepo, connection_mode: "github_app", github_installation_id: 42 };

const passingRun: CiPipelineRun = {
  id: 1,
  project_id: 7,
  repo_integration_id: 3,
  github_run_id: 100,
  github_workflow_id: 5,
  workflow_name: "CI",
  run_number: 12,
  status: "completed",
  conclusion: "success",
  branch: "main",
  commit_sha: "abcdef1234567",
  commit_message: "Fix the thing",
  event: "push",
  html_url: "https://github.com/acme/widgets/actions/runs/100",
  run_started_at: "2026-01-03T00:00:00Z",
  run_completed_at: "2026-01-03T00:05:00Z",
  duration_seconds: 300,
  observed_at: "2026-01-03T00:05:00Z",
  created_at: "2026-01-03T00:05:00Z",
};

function baseProps() {
  return {
    repo: null as RepoIntegration | null,
    repoLoading: false,
    latestRun: null as CiPipelineRun | null,
    runLoading: false,
    runError: "",
    needsReauthorization: false,
    runHistory: [] as CiPipelineRun[],
    historyLoading: false,
    historyError: "",
    monitor: null,
    monitorLoading: false,
    monitorPending: false,
    syncing: false,
    onSyncNow: vi.fn(),
    onUpdateMonitor: vi.fn(),
    onPauseMonitor: vi.fn(),
  };
}

describe("BuildStatusCard", () => {
  it("shows an empty state when no repository is connected", () => {
    render(<BuildStatusCard {...baseProps()} />);
    expect(screen.getByText("Attach a repository before checking build status.")).toBeInTheDocument();
  });

  it("shows a GitHub App prompt when the repo is only connected by URL", () => {
    render(<BuildStatusCard {...baseProps()} repo={publicUrlRepo} />);
    expect(screen.getByText("Connect via GitHub App to see build status.")).toBeInTheDocument();
  });

  it("shows a distinct re-authorization state, not the not-connected empty state", () => {
    render(<BuildStatusCard {...baseProps()} repo={githubAppRepo} needsReauthorization />);
    expect(screen.getByText("This GitHub App installation needs updated permissions.")).toBeInTheDocument();
    expect(screen.queryByText("Connect via GitHub App to see build status.")).not.toBeInTheDocument();
  });

  it("shows a not-synced state when connected via GitHub App but nothing has synced yet", () => {
    render(<BuildStatusCard {...baseProps()} repo={githubAppRepo} />);
    expect(screen.getByText("No build status has been synced yet.")).toBeInTheDocument();
  });

  it("renders the latest passing run with conclusion, commit, and duration", () => {
    render(<BuildStatusCard {...baseProps()} repo={githubAppRepo} latestRun={passingRun} />);
    expect(screen.getByLabelText("Build status: success")).toBeInTheDocument();
    expect(screen.getByText("abcdef1")).toBeInTheDocument();
    expect(screen.getByText("Fix the thing")).toBeInTheDocument();
  });

  it("renders an in-progress run without a conclusion", () => {
    const runningRun: CiPipelineRun = { ...passingRun, status: "in_progress", conclusion: null };
    render(<BuildStatusCard {...baseProps()} repo={githubAppRepo} latestRun={runningRun} />);
    expect(screen.getByLabelText("Build status: running")).toBeInTheDocument();
  });

  it("shows an empty build history message", () => {
    render(<BuildStatusCard {...baseProps()} repo={githubAppRepo} latestRun={passingRun} runHistory={[]} />);
    expect(screen.getByText("No build history yet.")).toBeInTheDocument();
  });

  it("calls onSyncNow when the sync button is clicked", async () => {
    const onSyncNow = vi.fn();
    render(<BuildStatusCard {...baseProps()} repo={githubAppRepo} onSyncNow={onSyncNow} />);
    await userEvent.click(screen.getByRole("button", { name: "Sync build status" }));
    expect(onSyncNow).toHaveBeenCalledTimes(1);
  });
});
