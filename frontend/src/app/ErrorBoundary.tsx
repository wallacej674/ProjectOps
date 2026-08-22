import { Component, type ReactNode } from "react";
import { ErrorState } from "../components/ui/ErrorState";
import { captureFrontendException } from "../observability/monitoring";

type ErrorWithRequestId = Error & {
  requestId?: string;
};

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  requestId?: string;
};

function requestIdFromError(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "requestId" in error) {
    const requestId = (error as ErrorWithRequestId).requestId;
    return typeof requestId === "string" && requestId.trim() ? requestId : undefined;
  }
  return undefined;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, requestId: requestIdFromError(error) };
  }

  componentDidCatch(error: Error) {
    captureFrontendException(error, { requestId: requestIdFromError(error) });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="error-boundary-shell" id="main-content">
        <ErrorState title="ProjectOps could not render this view" requestId={this.state.requestId}>
          <p>The current view stopped rendering. Reload the page, or return to Overview and continue from there.</p>
          <div className="error-actions">
            <button className="button primary" type="button" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="button" href="/app/overview">
              Return to Overview
            </a>
          </div>
        </ErrorState>
      </main>
    );
  }
}
