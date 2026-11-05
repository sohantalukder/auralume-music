"use client";

import Link from "next/link";
import { Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/utils";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";
import { usePlayerEngine } from "@/components/player/player-engine";
import { Skeleton } from "@/components/ui/skeleton";

export function BottomPlayer() {
  const track = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeat = usePlayerStore((state) => state.repeat);
  const liked = usePlayerStore((state) => track ? state.likedIds.includes(track.id) : false);
  const { currentTime, duration, loading, seek } = usePlayerEngine();
  const store = usePlayerStore();

  if (!track) return null;
  return (
    <div className="player-shell" aria-label="Music player">
      <div className="player-track">
        <Link href="/player" className="player-track-link" aria-label={`Open full player for ${track.title}`}><img src={track.artwork || "/artwork/local.svg"} alt="" /><div className="min-w-0"><strong>{track.title}</strong><span>{track.artist}</span></div></Link>
        <button className={liked ? "icon-button active" : "icon-button"} onClick={() => store.toggleLike(track.id)} aria-label={liked ? "Unlike" : "Like"}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button>
      </div>
      <div className="player-center">
        <div className="player-controls">
          <button className={shuffle ? "icon-button active" : "icon-button"} onClick={store.toggleShuffle} aria-label="Shuffle"><Shuffle size={17} /></button>
          <button className="icon-button" onClick={store.previous} aria-label="Previous"><SkipBack size={20} fill="currentColor" /></button>
          <button className="play-button" disabled={loading} onClick={isPlaying ? store.pause : store.resume} aria-label={loading ? "Loading audio" : isPlaying ? "Pause" : "Play"}>{loading ? <Skeleton className="skeleton-control" /> : isPlaying ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
          <button className="icon-button" onClick={() => store.next()} aria-label="Next"><SkipForward size={20} fill="currentColor" /></button>
          <button className={repeat !== "off" ? "icon-button active" : "icon-button"} onClick={store.cycleRepeat} aria-label={`Repeat ${repeat}`}>{repeat === "one" ? <Repeat1 size={17} /> : <Repeat size={17} />}</button>
        </div>
        <div className="timeline"><span>{formatTime(currentTime)}</span><Slider value={[currentTime]} max={Math.max(duration, 1)} step={0.1} onValueChange={([value]) => seek(value)} /><span>{formatTime(duration)}</span></div>
      </div>
      <div className="player-actions">
        <Link href="/queue" className="icon-button" aria-label="Open queue"><ListMusic size={19} /></Link>
        <button className="icon-button" onClick={store.toggleMute} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <Slider className="volume-slider" value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={([value]) => store.setVolume(value)} />
      </div>
    </div>
  );
}
