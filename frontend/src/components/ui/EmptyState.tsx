import type { ReactNode } from "react";

/** A centered empty / no-results panel. Body and actions are passed as children. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
