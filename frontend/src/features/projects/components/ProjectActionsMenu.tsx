import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/** Compact "more actions" trigger for Edit/Archive, matching the account menu's interaction pattern. */
export function ProjectActionsMenu({
  projectId,
  onArchive,
  triggerLabel = "More Project actions",
}: {
  projectId: number;
  onArchive: () => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="project-actions-menu" ref={rootRef}>
      <button
        type="button"
        className="project-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((value) => !value)}
      >
        &#8943;
      </button>
      {open && (
        <div className="project-actions-panel" role="menu">
          <Link
            role="menuitem"
            className="project-actions-item"
            to={`/app/projects/${projectId}/edit`}
            onClick={() => setOpen(false)}
          >
            Edit Project
          </Link>
          <button
            type="button"
            role="menuitem"
            className="project-actions-item danger"
            onClick={() => {
              setOpen(false);
              onArchive();
            }}
          >
            Archive Project
          </button>
        </div>
      )}
    </div>
  );
}
