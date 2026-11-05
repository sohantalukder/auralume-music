"use client";

import { useEffect } from "react";
import { contrastRatio } from "@/lib/customization";
import { usePlayerStore } from "@/stores/player-store";

const variables = ["--background", "--surface", "--surface-elevated", "--foreground", "--muted", "--border", "--accent", "--accent-strong", "--accent-ink"];

export function CustomizationController() {
  const appearance = usePlayerStore((state) => state.appearance);
  useEffect(() => {
    const root = document.documentElement;
    if (!appearance.enabled) {
      variables.forEach((variable) => root.style.removeProperty(variable));
      return;
    }
    root.style.setProperty("--background", appearance.background);
    root.style.setProperty("--surface", appearance.surface);
    root.style.setProperty("--surface-elevated", `color-mix(in srgb, ${appearance.surface} 84%, ${appearance.foreground})`);
    root.style.setProperty("--foreground", appearance.foreground);
    root.style.setProperty("--muted", `color-mix(in srgb, ${appearance.foreground} 68%, ${appearance.background})`);
    root.style.setProperty("--border", `color-mix(in srgb, ${appearance.foreground} 18%, ${appearance.surface})`);
    root.style.setProperty("--accent", appearance.accent);
    root.style.setProperty("--accent-strong", `color-mix(in srgb, ${appearance.accent} 82%, ${appearance.foreground})`);
    root.style.setProperty("--accent-ink", contrastRatio(appearance.accent, "#111111") >= contrastRatio(appearance.accent, "#ffffff") ? "#111111" : "#ffffff");
    return () => variables.forEach((variable) => root.style.removeProperty(variable));
  }, [appearance]);
  return null;
}
