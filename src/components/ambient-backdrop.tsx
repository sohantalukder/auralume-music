"use client";

import { AnimatePresence, motion } from "motion/react";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";

/**
 * Tints the app with the current track's artwork so the frosted panels have colour to
 * blur. A blurred background image gives the mood without reading pixels, which
 * cross-origin artwork would block. "soft" sits behind the whole app; "full" is Now Playing.
 */
export function AmbientBackdrop({ intensity = "soft" }: { intensity?: "soft" | "full" }) {
  const artwork = usePlayerStore((state) => selectCurrentTrack(state)?.artwork);
  return (
    <div className="ambient" data-intensity={intensity} aria-hidden="true">
      <AnimatePresence initial={false}>
        {artwork
          ? <motion.div key={artwork} className="ambient-art" style={{ backgroundImage: `url("${artwork}")` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }} />
          : <motion.div key="idle" className="ambient-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }} />}
      </AnimatePresence>
      <div className="ambient-fade" />
    </div>
  );
}
