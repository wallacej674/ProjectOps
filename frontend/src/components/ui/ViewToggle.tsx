export type ProjectView = "cards" | "table";

/** Card/table view switch for the Project Registry. */
export function ViewToggle({ view, onChange }: { view: ProjectView; onChange: (view: ProjectView) => void }) {
  return (
    <div className="toggle" aria-label="Project view">
      <button type="button" aria-pressed={view === "cards"} onClick={() => onChange("cards")}>
        Cards
      </button>
      <button type="button" aria-pressed={view === "table"} onClick={() => onChange("table")}>
        Table
      </button>
    </div>
  );
}
