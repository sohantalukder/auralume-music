import { describe, expect, it } from "vitest";
import { activeLyricIndex, parseSyncedLyrics } from "@/lib/lyrics";

describe("synced lyrics", () => {
  it("parses timestamps and ignores metadata tags", () => {
    const lines = parseSyncedLyrics("[ar:Artist]\n[00:01.20]First line\n[00:03.50]Second line");
    expect(lines).toEqual([{ time: 1.2, text: "First line" }, { time: 3.5, text: "Second line" }]);
  });

  it("selects the latest line at the current playback time", () => {
    const lines = parseSyncedLyrics("[00:01.00]One\n[00:02.00]Two");
    expect(activeLyricIndex(lines, 1.5)).toBe(0);
    expect(activeLyricIndex(lines, 2.1)).toBe(1);
  });
});
