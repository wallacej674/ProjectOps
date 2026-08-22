import type { ReactNode } from "react";

/** A centered error panel. Body and recovery actions are passed as children. */
export function ErrorState({ title, requestId, children }: { title: string; requestId?: string; children?: ReactNode }) {
  return (
    <div className="panel empty error" role="alert">
      <h2>{title}</h2>
      {children}
      {requestId && <p className="request-id">Request ID: {requestId}</p>}
    </div>
  );
}
