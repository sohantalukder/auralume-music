import type { AppearanceSettings, EqualizerSettings } from "@/lib/types";

export const equalizerFrequencies = [60, 230, 910, 3600, 14000] as const;

export const equalizerPresets: Record<EqualizerSettings["preset"], number[]> = {
  flat: [0, 0, 0, 0, 0],
  bass: [6, 4, 0, -1, -2],
  vocal: [-2, 0, 4, 3, 0],
  bright: [-2, -1, 0, 3, 6],
  custom: [0, 0, 0, 0, 0],
};

export const defaultEqualizer: EqualizerSettings = { enabled: false, preset: "flat", gains: [...equalizerPresets.flat] };
export const defaultAppearance: AppearanceSettings = { enabled: false, background: "#0b0d09", surface: "#131610", foreground: "#f5f8ef", accent: "#b8f33c" };

export function normalizeEqualizer(value?: Partial<EqualizerSettings>): EqualizerSettings {
  const preset = value?.preset && value.preset in equalizerPresets ? value.preset : "flat";
  const gains = Array.isArray(value?.gains) && value.gains.length === equalizerFrequencies.length
    ? value.gains.map((gain) => Math.max(-12, Math.min(12, Number(gain) || 0)))
    : [...equalizerPresets[preset]];
  return { enabled: Boolean(value?.enabled), preset, gains };
}

function luminance(hex: string) {
  const rgb = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!rgb || rgb.length !== 3) return 0;
  const [r, g, b] = rgb.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first: string, second: string) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
