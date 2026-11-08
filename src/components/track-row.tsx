"use client";

import { Heart, Play } from "lucide-react";
import { TrackMenu } from "@/components/track-menu";
import { useShallow } from "zustand/react/shallow";
import { NowPlayingBars, PlayPauseIcon } from "@/components/player/play-pause-icon";
import type { Track } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { playerHref, selectCurrentTrack, usePlayerStore } from "@/stores/player-store";

export function TrackRow({ track, context, index, menuExtra }: { track: Track; context?: Track[]; index?: number; menuExtra?: (close: () => void) => React.ReactNode }) {
  const current = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const liked = usePlayerStore((state) => state.likedIds.includes(track.id));
  const store = usePlayerStore(useShallow((state) => ({ play: state.play, pause: state.pause, resume: state.resume, toggleLike: state.toggleLike })));
  const router = useRouter();
  const active = current?.id === track.id;
  const actionVerb = track.playable ? "Play" : "Unavailable";
  const activate = () => {
    if (!track.playable) return;
    if (active && isPlaying) store.pause(); else if (active) store.resume(); else store.play(track, context);
  };

  return (
    <div className={active ? "track-row active-row" : "track-row"}>
      <button className="track-index" onClick={activate} aria-label={`${actionVerb} ${track.title}`}>
        {active ? <NowPlayingBars playing={isPlaying} /> : <span className="row-number">{index !== undefined ? index + 1 : ""}</span>}
        {track.playable && <span className="row-play">{active ? <PlayPauseIcon playing={isPlaying} size={17} /> : <Play size={17} fill="currentColor" />}</span>}
      </button>
      <img src={track.artwork || "/artwork/local.svg"} alt="" className="track-art" />
      <button className="track-copy track-copy-button" onClick={() => { if (!track.playable) return activate(); if (!active) store.play(track, context); router.push(playerHref(track)); }}><strong>{track.title}</strong><span>{track.artist}</span></button>
      <span className="track-album">{track.album || track.source}</span>
      {!track.playable && <span className="discovery-badge">Unavailable</span>}
      <span className="track-duration">{track.duration ? formatTime(track.duration) : "—"}</span>
      {track.playable && <button className={liked ? "icon-button row-like active" : "icon-button row-like"} onClick={() => store.toggleLike(track)} aria-label={liked ? "Unlike" : "Like"} aria-pressed={liked}><Heart size={17} fill={liked ? "currentColor" : "none"} /></button>}
      <TrackMenu track={track} extra={menuExtra} />
    </div>
  );
}
