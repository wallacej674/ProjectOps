export const hero = {
  eyebrow: "Project registry · CodeMap · Health · Readiness",
  title: "Know if it's ready before you ship it.",
  subtitle:
    "ProjectOps attaches to a GitHub repository, reads its structure, checks the live endpoint, " +
    "and turns the evidence into a reviewable readiness score.",
  primaryCta: "Open the Command Center",
  secondaryCta: "See how it works",
};

export const tickerStats: { label: string; value: string; tone: "accent" | "ok" | "warn" | "text" }[] = [
  { label: "Codemap", value: "15 signals", tone: "accent" },
  { label: "Health", value: "200 OK / 245 ms", tone: "ok" },
  { label: "Readiness", value: "67/100 · in progress", tone: "warn" },
  { label: "Checklist", value: "6 auto + 3 review", tone: "text" },
];

export const product = {
  eyebrow: "The instrument panel",
  title: "Four signals, one screen.",
  lede:
    "Every project gets the same panel — repository structure, endpoint health, readiness, and " +
    "detected stack — populated from real checks, not self-reported status.",
};

export const codemapSignals: { label: string; passed: boolean }[] = [
  { label: "readme", passed: true },
  { label: "tests", passed: true },
  { label: "ci", passed: true },
  { label: "docker", passed: true },
  { label: "env.example", passed: false },
  { label: "migrations", passed: true },
];

export const stackGroups: { label: string; chips: string[] }[] = [
  { label: "languages", chips: ["python", "typescript"] },
  { label: "frameworks", chips: ["fastapi", "react", "vite"] },
  { label: "tools", chips: ["docker", "alembic", "github actions"] },
];

export const workflow = {
  eyebrow: "A practical workflow",
  title: "From project record to a clearer production decision.",
  steps: [
    {
      title: "Create a project",
      text: "Name it, set its status and production URL — the registry is the single record everything else attaches to.",
    },
    {
      title: "Attach the repository",
      text: "Point ProjectOps at a GitHub repo. No agent, no webhook — just the reference.",
    },
    {
      title: "Run CodeMap",
      text: "A rule-based scan of file paths surfaces 15 structural signals and the detected stack. No code leaves your repo — only paths are read.",
    },
    {
      title: "Check the application",
      text: "An on-demand request to the production URL records status, HTTP code, and response time.",
    },
    {
      title: "Review readiness",
      text: "Nine checklist items — six automatic, three that require an engineer's sign-off — produce a score and the top gaps.",
    },
  ],
};

export const transparency = {
  eyebrow: "Transparency and security",
  title: "Assessments you can see into, not magic.",
  text:
    "Every signal is evidence-backed and inspectable. Three checklist items deliberately require " +
    "human review. A readiness score is an advisory summary — it is not a guarantee of production safety.",
};

export const footerLinks: { label: string; href: string; external?: boolean }[] = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Transparency", href: "#transparency" },
];
