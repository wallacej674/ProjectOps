import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("landing command-center preview", () => {
  it("states the health signal in readable text", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByText("System status: Healthy")).toBeInTheDocument();
  });
});
