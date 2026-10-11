import { describe, expect, it } from "vitest";
import { formatActivityTime } from "./format.js";

const now = new Date(2026, 9, 11, 15, 30).getTime();

describe("formatActivityTime", () => {
  it("shows only the time for today", () => {
    const today = new Date(2026, 9, 11, 9, 4).getTime();
    expect(formatActivityTime(today, now, "en-GB")).toBe("09:04");
  });

  it("shows the weekday within the last week", () => {
    const yesterday = new Date(2026, 9, 10, 23, 59).getTime();
    expect(formatActivityTime(yesterday, now, "en-GB")).toBe("Sat");
  });

  it("shows a short date for older entries", () => {
    const older = new Date(2026, 8, 24, 8, 0).getTime();
    expect(formatActivityTime(older, now, "en-GB")).toBe("24 Sept");
  });
});
