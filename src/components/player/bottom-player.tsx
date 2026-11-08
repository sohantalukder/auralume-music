"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Heart, ListMusic, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/utils";
import { playerHref, selectCurrentTrack, usePlayerStore } from "@/stores/player-store";
import { usePlayerEngine, usePlayerProgress } from "@/components/player/player-engine";
import { PlayPauseIcon } from "@/components/player/play-pause-icon";

function MiniTimeline() {
  const { duration, seek } = usePlayerEngine();
  const { currentTime } = usePlayerProgress();
  return <div className="timeline"><span>{formatTime(currentTime)}</span><Slider aria-label="Seek track" value={[currentTime]} max={Math.max(duration, 1)} step={0.1} onValueChange={([value]) => seek(value)} /><span>{formatTime(duration)}</span></div>;
}

function MobileTimeline() {
  const { duration, seek } = usePlayerEngine();
  const { currentTime } = usePlayerProgress();
  return <Slider className="mobile-player-timeline" aria-label="Seek track" value={[currentTime]} max={Math.max(duration, 1)} step={0.1} onValueChange={([value]) => seek(value)} />;
}

export function BottomPlayer() {
  const track = usePlayerStore(selectCurrentTrack);
  const { isPlaying, volume, muted, shuffle, repeat } = usePlayerStore(useShallow((state) => ({ isPlaying: state.isPlaying, volume: state.volume, muted: state.muted, shuffle: state.shuffle, repeat: state.repeat })));
  const liked = usePlayerStore((state) => track ? state.likedIds.includes(track.id) : false);
  const actions = usePlayerStore(useShallow((state) => ({ toggleLike: state.toggleLike, toggleShuffle: state.toggleShuffle, previous: state.previous, pause: state.pause, resume: state.resume, next: state.next, cycleRepeat: state.cycleRepeat, toggleMute: state.toggleMute, setVolume: state.setVolume })));
  const { loading } = usePlayerEngine();

  if (!track) return null;
  return (
    <motion.div className="player-shell" aria-label="Music player" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <div className="player-track">
        <Link href={playerHref(track)} className="player-track-link" aria-label={`Open full player for ${track.title}`}>
          <motion.img key={track.id} src={track.artwork || "/artwork/local.svg"} alt="" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} />
          <div className="min-w-0"><strong>{track.title}</strong><span>{track.artist}</span></div>
        </Link>
        <button className={liked ? "icon-button active" : "icon-button"} onClick={() => actions.toggleLike(track)} aria-label={liked ? "Unlike" : "Like"} aria-pressed={liked}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button>
      </div>
      <div className="player-center">
        <div className="player-controls">
          <button className={shuffle ? "icon-button active" : "icon-button"} onClick={actions.toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}><Shuffle size={17} /></button>
          <button className="icon-button" onClick={actions.previous} aria-label="Previous"><SkipBack size={20} fill="currentColor" /></button>
          <motion.button whileTap={{ scale: 0.9 }} className="play-button" disabled={loading} onClick={isPlaying ? actions.pause : actions.resume} aria-label={loading ? "Loading audio" : isPlaying ? "Pause" : "Play"}><PlayPauseIcon playing={isPlaying} loading={loading} size={21} /></motion.button>
          <button className="icon-button" onClick={() => actions.next()} aria-label="Next"><SkipForward size={20} fill="currentColor" /></button>
          <button className={repeat !== "off" ? "icon-button active" : "icon-button"} onClick={actions.cycleRepeat} aria-label={`Repeat ${repeat}`}>{repeat === "one" ? <Repeat1 size={17} /> : <Repeat size={17} />}</button>
        </div>
        <MiniTimeline />
      </div>
      <div className="player-actions">
        <Link href="/queue" className="icon-button" aria-label="Open queue"><ListMusic size={19} /></Link>
        <button className="icon-button" onClick={actions.toggleMute} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <Slider className="volume-slider" aria-label="Volume" value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={([value]) => actions.setVolume(value)} />
      </div>
      <MobileTimeline />
    </motion.div>
  );
}
