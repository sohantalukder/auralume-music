import { describe, expect, it } from "vitest";
import { formatTime, greeting } from "@/lib/utils";

describe("formatTime", () => {
  it("formats seconds as minutes and seconds", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(0)).toBe("0:00");
  });

  it("handles invalid values safely", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(-3)).toBe("0:00");
  });
});

describe("greeting", () => {
  it("changes by time of day", () => {
    expect(greeting(new Date("2026-01-01T08:00:00"))).toBe("Good morning");
    expect(greeting(new Date("2026-01-01T14:00:00"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-01-01T21:00:00"))).toBe("Good evening");
  });
});
