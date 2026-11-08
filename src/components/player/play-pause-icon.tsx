"use client";

import { Pause, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const swap = { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.6, opacity: 0 }, transition: { duration: 0.15 } };

/** Cross-fades between play, pause, and a loading ring so state changes read as motion, not a jump. */
export function PlayPauseIcon({ playing, loading = false, size }: { playing: boolean; loading?: boolean; size?: number }) {
  const state = loading ? "loading" : playing ? "pause" : "play";
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={state} className="play-pause-icon" {...swap}>
        {state === "loading" ? <span className="spinner-ring" style={size ? { width: size, height: size } : undefined} aria-hidden="true" /> : state === "pause" ? <Pause size={size} fill="currentColor" /> : <Play size={size} fill="currentColor" />}
      </motion.span>
    </AnimatePresence>
  );
}

/** Small equalizer bars marking the active track; they freeze while playback is paused. */
export function NowPlayingBars({ playing }: { playing: boolean }) {
  return <span className={playing ? "now-playing-bars" : "now-playing-bars paused"} aria-hidden="true"><i /><i /><i /></span>;
}
