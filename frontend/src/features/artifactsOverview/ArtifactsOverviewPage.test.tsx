import { fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../../app/App";
import { json, mockFetch } from "../../test/mockApi";

const projects = [
  { project_id: 7, project_name: "CivicPermit API", active_artifact_count: 2 },
  { project_id: 9, project_name: "Jobs", active_artifact_count: 1 },
];
const artifact = { id: 1, project_id: 7, title: "Deployment runbook", artifact_type: "runbook", source_type: "manual", status: "active", summary: "Deployment steps", content: "Restart the worker after migration.", tags: "launch, ops", url: null, updated_at: "2026-01-04T00:00:00Z" };
function setup(failed = false, empty = false) {
  mockFetch(url => {
    if (url.endsWith("/artifacts-overview")) return json(empty ? [] : projects);
    if (url.endsWith("/projects/7/artifacts")) return json([artifact, { ...artifact, id: 2, title: "API notes", artifact_type: "note", updated_at: "2026-01-01T00:00:00Z" }]);
    if (url.endsWith("/projects/9/artifacts")) return failed ? json({detail:"Unavailable"}, 500) : json([{ ...artifact, id: 3, project_id: 9, title: "Launch decision", artifact_type: "decision" }]);
    return json([]);
  });
  window.history.pushState({}, "", "/app/artifacts");
  render(<App />);
}
afterEach(() => vi.restoreAllMocks());
it("lists actual artifacts and opens an accessible reader with project management", async () => {
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Deployment runbook" }));
  const reader = screen.getByRole("dialog", {name: "Deployment runbook"});
  expect(within(reader).getByText("Restart the worker after migration.")).toBeInTheDocument();
  expect(within(reader).getByRole("link", {name: /Manage in project/})).toHaveAttribute("href", "/app/projects/7?view=artifacts");
  fireEvent.keyDown(document, {key: "Escape"});
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("combines content search, project and type filters and can clear them", async () => {
  setup();
  await screen.findByRole("table");
  fireEvent.change(screen.getByLabelText("Search library"), {target:{value:"migration"}});
  fireEvent.change(screen.getByLabelText("Project"), {target:{value:"7"}});
  fireEvent.change(screen.getByLabelText("Type"), {target:{value:"runbook"}});
  expect(screen.getByRole("button", {name:"Deployment runbook"})).toBeInTheDocument();
  expect(screen.queryByRole("button", {name:"Launch decision"})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search library"), {target:{value:"missing document"}});
  expect(screen.getByText("No matching artifacts")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"Clear filters"}));
  expect(screen.getByRole("button", {name:"Launch decision"})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Sort by"), {target:{value:"title"}});
  expect(within(screen.getAllByRole("row")[1]).getByRole("button", {name:"API notes"})).toBeInTheDocument();
});
it("keeps successful project records visible when another request fails", async () => {
  setup(true);
  expect(await screen.findByRole("button", {name:"Deployment runbook"})).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load artifacts for Jobs");
  expect(screen.getByText(/Incomplete results/)).toBeInTheDocument();
});
it("shows a useful empty state", async () => {
  setup(false, true);
  expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  expect(screen.getByRole("link", {name:/Browse projects/})).toHaveAttribute("href", "/app/projects");
});
