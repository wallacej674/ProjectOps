import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { captureFrontendException } from "../observability/monitoring";

vi.mock("../observability/monitoring", () => ({
  captureFrontendException: vi.fn(),
}));

function Crash({ requestId }: { requestId?: string }): ReactNode {
  const error = new Error("stack trace should stay hidden") as Error & { requestId?: string };
  error.requestId = requestId;
  throw error;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a safe fallback without stack details", async () => {
    render(
      <ErrorBoundary>
        <Crash requestId="boundary-request-123" />
      </ErrorBoundary>,
    );

    expect(await screen.findByRole("heading", { name: "ProjectOps could not render this view" })).toBeInTheDocument();
    expect(screen.getByText("Request ID: boundary-request-123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Overview" })).toHaveAttribute("href", "/app/overview");
    expect(screen.queryByText("stack trace should stay hidden")).not.toBeInTheDocument();
  });

  it("captures render errors for monitoring", async () => {
    render(
      <ErrorBoundary>
        <Crash requestId="boundary-request-456" />
      </ErrorBoundary>,
    );

    expect(await screen.findByRole("heading", { name: "ProjectOps could not render this view" })).toBeInTheDocument();
    expect(captureFrontendException).toHaveBeenCalledWith(expect.any(Error), { requestId: "boundary-request-456" });
  });
});
