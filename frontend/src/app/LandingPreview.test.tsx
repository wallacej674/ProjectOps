import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("landing session replay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });

  it("describes the replay outcome in readable text", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    // jsdom has no matchMedia, so the replay settles to its final frame
    // synchronously and the static summary is exposed to assistive tech.
    expect(screen.getByRole("img", { name: /readiness score 67 out of 100/i })).toBeInTheDocument();
    expect(screen.getByText("200 OK / 245 ms")).toBeInTheDocument();
  });

  it("renders the settled final frame when reduced motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string): MediaQueryList =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByText(/score 67\/100/)).toBeInTheDocument();
    // Appears in both the terminal replay and the readiness tile.
    expect(screen.getAllByText(/top gap: secrets management review/i).length).toBeGreaterThan(0);
  });

  it("keeps the landing dark-scoped when the app theme is light", () => {
    document.documentElement.dataset.theme = "light";
    window.history.pushState({}, "", "/");
    const { container } = render(<App />);

    // Dark-only rendering is enforced by the .landing token overrides in CSS;
    // the class hook on the page root is the observable contract in jsdom.
    expect(container.querySelector(".landing")).not.toBeNull();
  });
});
