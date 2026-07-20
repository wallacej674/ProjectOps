export type Tone = "prompt" | "ok" | "err" | "warn" | "accent" | "dim" | "text" | "strong";

export interface ReplaySegment {
  text: string;
  tone?: Tone;
}

export interface ReplayLine {
  segments: ReplaySegment[];
  /** Pause before this line appears, in ms. */
  delayMs: number;
  kind?: "line" | "progress";
}

/** Illustrative session mirroring the real analyze → health → readiness flow. */
export const REPLAY_SCRIPT: ReplayLine[] = [
  {
    delayMs: 500,
    segments: [
      { text: "projectops ▸ ", tone: "prompt" },
      { text: "attach repo github.com/civic/permit-api", tone: "text" },
    ],
  },
  {
    delayMs: 700,
    segments: [
      { text: "✓ ", tone: "ok" },
      { text: "repository attached · branch main", tone: "text" },
    ],
  },
  {
    delayMs: 600,
    segments: [
      { text: "projectops ▸ ", tone: "prompt" },
      { text: "run codemap", tone: "text" },
    ],
  },
  {
    delayMs: 900,
    segments: [
      { text: "✓ ", tone: "ok" },
      { text: "structural scan · 1,204 paths read", tone: "text" },
    ],
  },
  {
    delayMs: 550,
    segments: [
      { text: "  " },
      { text: "✓ fastapi  ", tone: "ok" },
      { text: "✓ docker  ", tone: "ok" },
      { text: "✓ ci  ", tone: "ok" },
      { text: "✓ tests  ", tone: "ok" },
      { text: "✗ env.example", tone: "err" },
    ],
  },
  {
    delayMs: 700,
    segments: [
      { text: "projectops ▸ ", tone: "prompt" },
      { text: "run health check", tone: "text" },
    ],
  },
  {
    delayMs: 900,
    segments: [
      { text: "✓ ", tone: "ok" },
      { text: "200 OK", tone: "ok" },
      { text: " · 245 ms · api.civicpermit.dev", tone: "text" },
    ],
  },
  {
    delayMs: 600,
    segments: [
      { text: "projectops ▸ ", tone: "prompt" },
      { text: "evaluate readiness", tone: "text" },
    ],
  },
  {
    delayMs: 800,
    kind: "progress",
    segments: [
      { text: "score 67/100", tone: "strong" },
      { text: " · in progress · 6 of 9 passed", tone: "text" },
    ],
  },
  {
    delayMs: 750,
    segments: [
      { text: "▸ ", tone: "warn" },
      { text: "top gap: secrets management review", tone: "warn" },
    ],
  },
];

/** Static description for assistive tech; also a stable test target. */
export const REPLAY_SUMMARY =
  "Replay of a ProjectOps session: repository attached, CodeMap structural scan of 1,204 paths, " +
  "health check 200 OK in 245 ms, readiness score 67 out of 100 with secrets management review as the top gap.";
