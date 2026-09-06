import type { ReactNode } from "react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import type { RepoAnalysis } from "../../../types/repoAnalysis";
import "./repositoryAnalysis.css";

export type Subsystem = "Frontend" | "Backend" | "Delivery";

const definitions: Record<Subsystem, { technologies: string[]; signals: string[]; description: string }> = {
  Frontend: {
    technologies: ["react", "vite", "typescript", "next.js", "vue", "angular", "svelte"],
    signals: ["has_frontend", "has_react", "has_typescript", "has_vite"],
    description: "UI frameworks and frontend tooling found in the repository.",
  },
  Backend: {
    technologies: ["python", "fastapi", "sqlalchemy", "alembic", "django", "flask", "express", "nestjs"],
    signals: ["has_backend", "has_python", "has_fastapi", "has_sqlalchemy", "has_alembic", "has_migrations"],
    description: "Service frameworks, data tools, and migration signals.",
  },
  Delivery: {
    technologies: ["github_actions", "github actions", "docker", "containers"],
    signals: ["has_ci", "has_tests", "has_docker"],
    description: "Automation, test, and container signals.",
  },
};

function subsystemData(analysis: RepoAnalysis, name: Subsystem) {
  const definition = definitions[name];
  const detectedValues = new Set([
    ...Object.values(analysis.detected_stack).flat(),
    ...(analysis.insights?.frameworks ?? []),
    ...(analysis.insights?.operational_signals ?? []),
  ].map((value) => value.toLowerCase()));
  const values = definition.technologies.filter((value) => detectedValues.has(value));
  const signals = definition.signals.filter((signal) => signal in analysis.signals);
  const detected = values.length > 0 || signals.some((signal) => analysis.signals[signal]);
  return { values, signals, detected };
}

function display(value: string) {
  const names: Record<string, string> = {
    react: "React", vite: "Vite", typescript: "TypeScript", python: "Python", fastapi: "FastAPI",
    sqlalchemy: "SQLAlchemy", alembic: "Alembic", github_actions: "GitHub Actions",
    "github actions": "GitHub Actions", docker: "Docker", containers: "Containers",
    has_frontend: "Frontend", has_backend: "Backend", has_ci: "CI", has_tests: "Tests",
    has_docker: "Docker", has_migrations: "Migrations", has_react: "React", has_vite: "Vite",
    has_fastapi: "FastAPI", has_sqlalchemy: "SQLAlchemy", has_alembic: "Alembic", has_python: "Python", has_typescript: "TypeScript",
  };
  return names[value] ?? value.replaceAll("_", " ");
}

export function RepositorySubsystems({ analysis, onInspect }: {
  analysis: RepoAnalysis;
  onInspect: (name: Subsystem) => void;
}) {
  return (
    <div className="repository-subsystems">
      {(Object.keys(definitions) as Subsystem[]).map((name) => {
        const { values, detected } = subsystemData(analysis, name);
        return (
          <section className="repository-subsystem" key={name} aria-label={name}>
            <svg className="repository-subsystem-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {name === "Frontend" ? <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 9v11" /></> : name === "Backend" ? <><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h.01M7 17.5h.01" /></> : <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v10M18 17v-6a6 6 0 0 0-6-6h-1m2-2-2 2 2 2" /></>}
            </svg>
            <h3>{name}</h3>
            <p className="repository-subsystem-stack">{values.length ? values.slice(0, 2).map(display).join(" + ") : detected ? "Signals detected" : "No signals detected"}</p>
            {values.length > 2 && <p className="meta">{values.slice(2).map(display).join(" · ")}</p>}
            {name === "Delivery" && <p className="meta">{["has_tests", "has_docker"].filter((key) => key in analysis.signals).map((key) => `${display(key)} ${analysis.signals[key] ? "detected" : "not detected"}`).join(" · ")}</p>}
            <p className="repository-subsystem-description">{definitions[name].description}</p>
            <button className="repository-detail-link" type="button" onClick={() => onInspect(name)}>
              Inspect {name.toLowerCase()} <span aria-hidden="true">→</span>
            </button>
          </section>
        );
      })}
    </div>
  );
}

export function SubsystemDetails({ analysis, name }: { analysis: RepoAnalysis; name: Subsystem }) {
  const { values, signals } = subsystemData(analysis, name);
  // Match evidence by the reported signal, not by guessing a file's role from its extension.
  const evidence = Object.entries(analysis.evidence_files ?? {}).filter(([key]) =>
    [...values, ...definitions[name].technologies].some((value) => key.split(":").slice(1).join(":").trim().toLowerCase() === value.toLowerCase()),
  );
  const sourcePaths = new Set(evidence.flatMap(([, paths]) => paths));
  const relatedEvidence = Object.entries(analysis.evidence_files ?? {}).filter(([key, paths]) =>
    /^(command|runtime|package_manager):/.test(key) && paths.some((path) => sourcePaths.has(path)),
  );
  return (
    <div className="repository-inspector-content">
      <h3>Detected technologies</h3>
      {values.length ? <ul className="chip-list">{values.map((value) => <li key={value}>{display(value)}</li>)}</ul> : <p className="meta">No matching technologies were returned.</p>}
      <h3>Architecture signals</h3>
      {signals.length ? <ul className="repository-signal-list">{signals.map((signal) => <li key={signal}><span>{display(signal)}</span><span className={analysis.signals[signal] ? "success-text" : "meta"}>{analysis.signals[signal] ? "Detected" : "Not detected"}</span></li>)}</ul> : <p className="meta">No matching architecture signals were returned.</p>}
      <h3>Source evidence</h3>
      {evidence.length ? <dl>{evidence.map(([key, paths]) => <div className="definition" key={key}><dt>{key.replaceAll("_", " ")}</dt><dd className="mono">{paths.join(", ")}</dd></div>)}</dl> : <p className="meta">No manifest evidence was returned for these findings. Path-based findings and all inspected files remain available under All evidence.</p>}
      {relatedEvidence.length > 0 && <><h3>Commands and runtime in the same manifests</h3><dl>{relatedEvidence.map(([key, paths]) => <div className="definition" key={key}><dt className="mono">{key.replace(":", ": ")}</dt><dd className="mono">{paths.join(", ")}</dd></div>)}</dl></>}
      <p className="meta">These are repository signals, not verification that the application or its tests run successfully.</p>
    </div>
  );
}

export function RepositoryAnalysisDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useFocusTrap<HTMLElement>(true, onClose);
  return (
    <div className="modal-backdrop repository-analysis-backdrop" role="presentation">
      <section className="modal panel repository-analysis-dialog" role="dialog" aria-modal="true" aria-labelledby="repository-dialog-title" ref={ref}>
        <div className="repository-dialog-header"><h2 id="repository-dialog-title">{title}</h2><button className="button" type="button" onClick={onClose}>Close</button></div>
        {children}
      </section>
    </div>
  );
}
