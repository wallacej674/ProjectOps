import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("application entry", () => {
  it("renders the ProjectOps command center entry point", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /see the state of every project/i })).toBeInTheDocument();
  });
});
