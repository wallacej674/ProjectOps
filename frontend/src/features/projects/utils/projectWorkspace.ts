export const projectViews = ["release", "overview", "repository", "monitoring", "launch", "artifacts", "activity", "settings"] as const;
export type ProjectView = typeof projectViews[number];
export type LaunchView = "checklist" | "report" | "decisions";
const legacyViews: Record<string, ProjectView> = { overview: "overview", repository: "repository", codemap: "repository", "repo-connection-title": "repository", health: "monitoring", readiness: "launch", "launch-report": "launch", "launch-decision": "launch", artifacts: "artifacts", activity: "activity", details: "settings" };
export function projectWorkspaceLocation(search: string, hash: string): { view: ProjectView; launch: LaunchView } {
  const params = new URLSearchParams(search), anchor = hash.replace(/^#/, "");
  const requested = params.get("view") as ProjectView;
  const view = legacyViews[anchor] ?? (projectViews.includes(requested) ? requested : "overview");
  const launch = anchor === "launch-report" ? "report" : anchor === "launch-decision" ? "decisions" : anchor === "readiness" ? "checklist" : params.get("section");
  return { view, launch: launch === "report" || launch === "decisions" ? launch : "checklist" };
}
export function workspaceHref(view: ProjectView, section?: LaunchView) { return `?view=${view}${section ? `&section=${section}` : ""}`; }
