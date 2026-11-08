"use client";

import { Heart } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { PlayPauseIcon } from "@/components/player/play-pause-icon";
import type { Track } from "@/lib/types";
import { playerHref, selectCurrentTrack, usePlayerStore } from "@/stores/player-store";
import { useRouter } from "next/navigation";

export function TrackCard({ track, context }: { track: Track; context: Track[] }) {
  const current = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const liked = usePlayerStore((state) => state.likedIds.includes(track.id));
  const store = usePlayerStore(useShallow((state) => ({ play: state.play, pause: state.pause, resume: state.resume, toggleLike: state.toggleLike })));
  const router = useRouter();
  const active = current?.id === track.id;
  const activate = () => {
    if (!track.playable) return;
    if (active && isPlaying) { store.pause(); return; }
    if (active) store.resume(); else store.play(track, context);
    router.push(playerHref(track));
  };
  return (
    <article className="track-card">
      <div className="card-art"><img src={track.artwork || "/artwork/local.svg"} alt="" /><div className="card-source">{track.source}</div><button onClick={activate} disabled={!track.playable} aria-label={`${track.playable ? "Play" : "Unavailable"} ${track.title}`}>{track.playable ? <PlayPauseIcon playing={active && isPlaying} /> : null}</button></div>
      <div className="card-copy"><div><strong>{track.title}</strong><span>{track.artist}</span></div>{track.playable && <button className={liked ? "icon-button active" : "icon-button"} onClick={() => store.toggleLike(track)} aria-label={liked ? "Unlike" : "Like"} aria-pressed={liked}><Heart size={17} fill={liked ? "currentColor" : "none"} /></button>}</div>
    </article>
  );
}
