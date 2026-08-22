import { describe, expect, it } from "vitest";
import type { ProjectArtifact } from "../../../types/projectArtifact";
import {
  getLaunchDecisionHistory,
  getLaunchDecisionNotes,
  getLaunchDecisionValue,
} from "./launchDecisionArtifacts";

const baseArtifact: ProjectArtifact = {
  id: 1,
  project_id: 7,
  created_by_user_id: null,
  created_by_user: null,
  title: "Launch decision: Go",
  artifact_type: "decision",
  source_type: "manual",
  url: null,
  content: "Decision: go\n\nNotes:\nLaunch window approved by the human reviewer.",
  summary: "Launch window approved by the human reviewer.",
  tags: "launch-decision,go-no-go,go",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("launch decision artifacts", () => {
  it("keeps only active Project Artifact launch decision records newest-first by recorded time", () => {
    const olderGo = { ...baseArtifact, id: 10, created_at: "2026-01-01T00:00:00Z" };
    const newestDefer = {
      ...baseArtifact,
      id: 12,
      title: "Launch decision: Defer",
      tags: "launch-decision,go-no-go,defer",
      created_at: "2026-01-03T00:00:00Z",
      updated_at: "2026-01-03T00:00:00Z",
    };
    const unrelatedDecision = {
      ...baseArtifact,
      id: 13,
      title: "Architecture decision",
      tags: "architecture,adr",
      created_at: "2026-01-04T00:00:00Z",
    };
    const unrelatedArtifact = {
      ...baseArtifact,
      id: 14,
      title: "Deployment evidence",
      artifact_type: "evidence" as const,
      tags: "launch-decision,go-no-go,no-go",
      created_at: "2026-01-05T00:00:00Z",
    };
    const archivedNoGo = {
      ...baseArtifact,
      id: 15,
      title: "Launch decision: No-go",
      tags: "launch-decision,go-no-go,no-go",
      status: "archived" as const,
      created_at: "2026-01-06T00:00:00Z",
    };

    expect(
      getLaunchDecisionHistory([olderGo, unrelatedDecision, newestDefer, unrelatedArtifact, archivedNoGo]).map(
        (artifact) => artifact.id,
      ),
    ).toEqual([12, 10]);
  });

  it("can intentionally include archived launch decision records", () => {
    const archivedNoGo = {
      ...baseArtifact,
      id: 20,
      title: "Launch decision: No-go",
      tags: "launch-decision,go-no-go,no-go",
      status: "archived" as const,
      created_at: "2026-01-04T00:00:00Z",
    };

    expect(getLaunchDecisionHistory([baseArtifact, archivedNoGo], { includeArchived: true }).map((artifact) => artifact.id)).toEqual([
      20,
      1,
    ]);
  });

  it("derives decision value and notes from artifact metadata without inventing signer data", () => {
    expect(getLaunchDecisionValue(baseArtifact)).toBe("go");
    expect(getLaunchDecisionNotes(baseArtifact)).toBe("Launch window approved by the human reviewer.");

    expect(
      getLaunchDecisionValue({
        ...baseArtifact,
        title: "Launch decision: No-go",
        summary: null,
        content: "Decision: no-go\n\nNotes:\nCI is failing.",
        tags: "launch-decision,go-no-go,no-go",
      }),
    ).toBe("no_go");
    expect(
      getLaunchDecisionNotes({
        ...baseArtifact,
        summary: null,
        content: "Decision: defer\n\nNotes:\nWait for Sentry proof.",
        tags: "launch-decision,go-no-go,defer",
      }),
    ).toBe("Wait for Sentry proof.");
  });
});
