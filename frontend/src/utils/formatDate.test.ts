import { formatDate } from "./formatDate";

describe("formatDate", () => {
  const now = new Date("2026-09-02T15:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes the time of day for a timestamp from a few minutes ago", () => {
    const result = formatDate("2026-09-02T14:45:00.000Z");
    expect(result).toContain("2026");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("includes the time of day for a timestamp exactly at the 24-hour boundary", () => {
    const result = formatDate("2026-09-01T15:00:01.000Z");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("omits the time of day for a timestamp more than 24 hours ago", () => {
    const result = formatDate("2026-08-30T00:00:00.000Z");
    expect(result).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("omits the time of day for a future timestamp", () => {
    const result = formatDate("2026-09-03T00:00:00.000Z");
    expect(result).not.toMatch(/\d{1,2}:\d{2}/);
  });
});
