"use client";

import { Download, Heart, ListMusic, Mic2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LyricsPanel } from "@/components/player/lyrics-panel";
import { usePlayerEngine } from "@/components/player/player-engine";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime } from "@/lib/utils";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";

export function FullPlayerScreen() {
  const track = usePlayerStore(selectCurrentTrack);
  const store = usePlayerStore();
  const { currentTime, duration, loading, error, seek } = usePlayerEngine();
  const startX = useRef<number | undefined>(undefined);
  const [lyricsFor, setLyricsFor] = useState<string | null>(null);
  const lyricsOpen = Boolean(track && lyricsFor === track.id);

  useEffect(() => {
    if (!lyricsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setLyricsFor(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [lyricsOpen]);

  if (!track) return <div className="empty-state tall"><Play /><h2>Nothing playing</h2><p>Pick a track from Home, Discover, or your library.</p></div>;
  const liked = store.likedIds.includes(track.id);
  const swipe = (endX: number) => {
    if (startX.current === undefined) return;
    const distance = endX - startX.current;
    if (Math.abs(distance) > 60) {
      if (distance < 0) store.next(); else store.previous();
    }
    startX.current = undefined;
  };

  return (
    <div className="full-player-layout">
      <section className="now-playing-panel">
        <div className="fullscreen-glow" style={{ backgroundImage: `url(${track.artwork || "/artwork/local.svg"})` }} />
        <div className="player-art-wrap" onTouchStart={(event) => { startX.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => swipe(event.changedTouches[0].clientX)}>
          <img src={track.artwork || "/artwork/local.svg"} alt={`${track.title} artwork`} />
          <span>{track.source === "youtube" ? "YouTube audio" : track.source}</span>
        </div>
        <div className="full-track-copy"><span className="eyebrow">Now playing</span><h1>{track.title}</h1><p>{track.artist}{track.album ? ` · ${track.album}` : ""}</p></div>
        {error && <p className="player-error">{error}</p>}
        <div className="full-timeline"><Slider value={[currentTime]} max={Math.max(duration, 1)} step={0.1} onValueChange={([value]) => seek(value)} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div>
        <div className="full-controls">
          <button className={store.shuffle ? "icon-button active" : "icon-button"} onClick={store.toggleShuffle} aria-label="Shuffle"><Shuffle /></button>
          <button className="icon-button" onClick={store.previous} aria-label="Previous track"><SkipBack fill="currentColor" /></button>
          <button className="full-play-button" disabled={loading} onClick={store.isPlaying ? store.pause : store.resume} aria-label={loading ? "Loading audio" : store.isPlaying ? "Pause" : "Play"}>{loading ? <Skeleton className="skeleton-control" /> : store.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <button className="icon-button" onClick={() => store.next()} aria-label="Next track"><SkipForward fill="currentColor" /></button>
          <button className={store.repeat !== "off" ? "icon-button active" : "icon-button"} onClick={store.cycleRepeat} aria-label={`Repeat ${store.repeat}`}>{store.repeat === "one" ? <Repeat1 /> : <Repeat />}</button>
        </div>
        <div className="full-player-actions">
          <button className={liked ? "action-chip active" : "action-chip"} onClick={() => store.toggleLike(track.id)}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {liked ? "Liked" : "Like"}</button>
          <button className="action-chip" onClick={() => setLyricsFor(track.id)}><Mic2 size={17} /> Lyrics</button>
          {track.downloadUrl && <a className="action-chip" href={track.downloadUrl}><Download size={17} /> Download MP3</a>}
          <Link className="action-chip" href="/queue"><ListMusic size={17} /> Queue</Link>
        </div>
        {track.source !== "youtube" && <p className="source-note">{track.license?.name || "Source information unavailable"}</p>}
      </section>

      {lyricsOpen && <div className="lyrics-sheet-backdrop" onMouseDown={() => setLyricsFor(null)}>
        <section className="lyrics-sheet" role="dialog" aria-modal="true" aria-label={`Lyrics for ${track.title}`} onMouseDown={(event) => event.stopPropagation()}>
          <button className="lyrics-sheet-close" onClick={() => setLyricsFor(null)} aria-label="Close lyrics"><X /></button>
          <LyricsPanel track={track} currentTime={currentTime} onSeek={seek} />
        </section>
      </div>}
    </div>
  );
}
