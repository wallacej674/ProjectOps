import type { ProjectSectionId } from "../utils/projectCommandCenter";

const sections: { id: ProjectSectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "repository", label: "Repository" },
  { id: "codemap", label: "CodeMap" },
  { id: "health", label: "Health" },
  { id: "readiness", label: "Readiness" },
  { id: "launch-report", label: "Launch Report" },
  { id: "launch-decision", label: "Launch Decision" },
  { id: "artifacts", label: "Artifacts" },
  { id: "activity", label: "Activity" },
  { id: "details", label: "Details" },
];

export function ProjectSectionNav() {
  return (
    <nav className="section-nav" aria-label="Project sections">
      {sections.map((section) => (
        <a href={`#${section.id}`} key={section.id}>
          {section.label}
        </a>
      ))}
    </nav>
  );
}
