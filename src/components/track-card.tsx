"use client";

import { Heart, Pause, Play } from "lucide-react";
import type { Track } from "@/lib/types";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";
import { useRouter } from "next/navigation";

export function TrackCard({ track, context }: { track: Track; context: Track[] }) {
  const current = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const liked = usePlayerStore((state) => state.likedIds.includes(track.id));
  const store = usePlayerStore();
  const router = useRouter();
  const active = current?.id === track.id;
  const activate = () => {
    if (!track.playable) return;
    if (active && isPlaying) store.pause(); else if (active) store.resume(); else store.play(track, context);
    router.push("/player");
  };
  return (
    <article className="track-card">
      <div className="card-art"><img src={track.artwork || "/artwork/local.svg"} alt="" /><div className="card-source">{track.source}</div><button onClick={activate} disabled={!track.playable} aria-label={`${track.playable ? "Play" : "Unavailable"} ${track.title}`}>{track.playable ? active && isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" /> : null}</button></div>
      <div className="card-copy"><div><strong>{track.title}</strong><span>{track.artist}</span></div>{track.playable && <button className={liked ? "icon-button active" : "icon-button"} onClick={() => store.toggleLike(track.id)} aria-label={liked ? "Unlike" : "Like"}><Heart size={17} fill={liked ? "currentColor" : "none"} /></button>}</div>
    </article>
  );
}
