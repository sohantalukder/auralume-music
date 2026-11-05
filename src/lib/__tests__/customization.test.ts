import { describe, expect, it } from "vitest";
import { contrastRatio, equalizerPresets, normalizeEqualizer } from "@/lib/customization";

describe("sound and appearance customization", () => {
  it("normalizes persisted equalizer data and clamps unsafe gains", () => {
    expect(normalizeEqualizer({ enabled: true, preset: "custom", gains: [20, -20, 1, 2, 3] })).toEqual({ enabled: true, preset: "custom", gains: [12, -12, 1, 2, 3] });
    expect(normalizeEqualizer({ preset: "bass" }).gains).toEqual(equalizerPresets.bass);
  });

  it("reports WCAG-style color contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });
});
