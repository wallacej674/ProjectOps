import type { ReactNode } from "react";

/** A centered error panel. Body and recovery actions are passed as children. */
export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel empty error">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
