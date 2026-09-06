import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../app/App";
import { json, mockFetch } from "../../test/mockApi";

const overviews = [
  {
    project_id: 7,
    project_name: "CivicPermit API",
    project_status: "development",
    score: 66,
    status: "in_progress",
    passed: 6,
    failed: 0,
    unknown: 3,
    not_applicable: 0,
    total_applicable: 9,
    top_gaps: ["Deployment Docs Reviewed"],
  },
  {
    project_id: 9,
    project_name: "jobs we will get",
    project_status: "development",
    score: null,
    status: "not_started",
    passed: 0,
    failed: 0,
    unknown: 0,
    not_applicable: 0,
    total_applicable: 0,
    top_gaps: [],
  },
];

function goReadiness() {
  window.history.pushState({}, "", "/app/readiness");
}

function mockReadiness(response = json(overviews)) {
  return mockFetch((url, init) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/readiness") && method === "GET") return response;
    return json([]);
  });
}

describe("Cross-project Readiness page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the readiness score for each project", async () => {
    mockReadiness();
    goReadiness();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Readiness" });
    const table = within(page).getByRole("table", { name: "Project readiness status" });
    expect(within(table).getByText("CivicPermit API")).toBeInTheDocument();
    expect(within(table).getByRole("progressbar", { name: "CivicPermit API readiness score" })).toHaveAttribute("value", "66");
    expect(within(table).getByText("Deployment Docs Reviewed")).toBeInTheDocument();
    expect(within(table).getByText("Needs review")).toBeInTheDocument();
    expect(within(table).getByText("jobs we will get")).toBeInTheDocument();
    expect(within(page).getByText("Not evaluated")).toBeInTheDocument();
    expect(within(page).getByRole("link", { name: "CivicPermit API" })).toHaveAttribute(
      "href",
      "/app/projects/7#readiness",
    );
  });

  it("filters projects and attention together and clears an empty filter", async () => {
    const user = userEvent.setup();
    mockReadiness();
    goReadiness();
    render(<App />);
    await screen.findByRole("table", { name: "Project readiness status" });
    await user.click(screen.getByRole("button", { name: /^In progress/ }));
    expect(screen.getByRole("button", { name: /^In progress/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("jobs we will get")).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Attention needed" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Strong/ }));
    expect(screen.getByText("No matching projects")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Attention needed" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("link", { name: "Evaluate project: jobs we will get" })).toHaveAttribute("href", "/app/projects/9#readiness");
  });

  it("searches and sorts scores with unevaluated projects first", async () => {
    const user = userEvent.setup();
    mockReadiness();
    goReadiness();
    render(<App />);
    const table = await screen.findByRole("table", { name: "Project readiness status" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "score");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("jobs we will get");
    await user.type(screen.getByRole("searchbox", { name: "Search projects" }), "civic");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByText("jobs we will get")).not.toBeInTheDocument();
  });

  it("keeps a zero score distinct from not evaluated", async () => {
    mockReadiness(json([{ ...overviews[0], score: 0, status: "needs_work", passed: 0, failed: 9, unknown: 0 }, overviews[1]]));
    goReadiness();
    render(<App />);
    const table = await screen.findByRole("table", { name: "Project readiness status" });
    expect(within(table).getByRole("progressbar")).toHaveAttribute("value", "0");
    expect(within(table).getAllByText("Not evaluated")).toHaveLength(1);
    expect(within(table).getByRole("link", { name: "View checklist: CivicPermit API" })).toBeInTheDocument();
  });

  it("hides attention when all applicable checks have passed", async () => {
    mockReadiness(json([{ ...overviews[0], score: 100, status: "strong", passed: 9, unknown: 0, top_gaps: [] }]));
    goReadiness();
    render(<App />);
    await screen.findByRole("table", { name: "Project readiness status" });
    expect(screen.getByText("All applicable checks passed")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Attention needed" })).not.toBeInTheDocument();
  });

  it("shows an empty state with no projects", async () => {
    mockReadiness(json([]));
    goReadiness();

    render(<App />);

    const page = await screen.findByRole("region", { name: "Readiness" });
    expect(within(page).getByText(/No projects/i)).toBeInTheDocument();
  });
});
