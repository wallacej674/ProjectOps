import { defaultSort, sortProjects } from "./projectSort";
import { makeProject } from "../../test/mockApi";

const p = (id: number, name: string, updated: string, status = "development") =>
  makeProject({ id, name, updated_at: updated, status: status as never });

describe("sortProjects", () => {
  const alpha = p(1, "Alpha", "2026-03-01T00:00:00Z");
  const mid = p(2, "Mango", "2026-02-01T00:00:00Z");
  const zeta = p(3, "Zeta", "2026-01-01T00:00:00Z");

  it("defaults to most recently updated first", () => {
    expect(defaultSort).toBe("updated-desc");
    expect(sortProjects([zeta, alpha, mid], defaultSort).map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("sorts oldest updated first", () => {
    expect(sortProjects([alpha, mid, zeta], "updated-asc").map((x) => x.id)).toEqual([3, 2, 1]);
  });

  it("sorts by name ascending and descending", () => {
    expect(sortProjects([zeta, alpha, mid], "name-asc").map((x) => x.name)).toEqual(["Alpha", "Mango", "Zeta"]);
    expect(sortProjects([alpha, mid, zeta], "name-desc").map((x) => x.name)).toEqual(["Zeta", "Mango", "Alpha"]);
  });

  it("sorts by lifecycle status order", () => {
    const planning = p(10, "B", "2026-01-01T00:00:00Z", "planning");
    const production = p(11, "A", "2026-01-01T00:00:00Z", "production");
    const archived = p(12, "C", "2026-01-01T00:00:00Z", "archived");
    expect(sortProjects([archived, production, planning], "status").map((x) => x.status)).toEqual([
      "planning",
      "production",
      "archived",
    ]);
  });

  it("breaks ties deterministically by name then id", () => {
    const sameTimeB = p(5, "Beta", "2026-05-01T00:00:00Z");
    const sameTimeA = p(7, "Alpha", "2026-05-01T00:00:00Z");
    const sameNameLowId = p(2, "Alpha", "2026-05-01T00:00:00Z");
    const result = sortProjects([sameTimeB, sameTimeA, sameNameLowId], "updated-desc").map((x) => x.id);
    // Equal timestamps -> name asc (Alpha before Beta); equal names -> lower id first.
    expect(result).toEqual([2, 7, 5]);
  });

  it("does not mutate the input array", () => {
    const input = [alpha, mid, zeta];
    const snapshot = input.map((x) => x.id);
    sortProjects(input, "name-asc");
    expect(input.map((x) => x.id)).toEqual(snapshot);
  });
});
