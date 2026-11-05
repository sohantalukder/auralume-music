"use client";

import { Download, Heart, ListMusic, ListPlus, Pause, Play } from "lucide-react";
import type { Track } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";

export function TrackRow({ track, context, index }: { track: Track; context?: Track[]; index?: number }) {
  const current = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const liked = usePlayerStore((state) => state.likedIds.includes(track.id));
  const store = usePlayerStore();
  const localPlaylists = store.playlists.filter((playlist) => playlist.source !== "youtube");
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
        <span>{index !== undefined ? index + 1 : ""}</span>
        {track.playable ? active && isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" /> : null}
      </button>
      <img src={track.artwork || "/artwork/local.svg"} alt="" className="track-art" />
      <button className="track-copy track-copy-button" onClick={() => { if (!track.playable) return activate(); if (!active) store.play(track, context); router.push("/player"); }}><strong>{track.title}</strong><span>{track.artist}</span></button>
      <span className="track-album">{track.album || track.source}</span>
      {!track.playable && <span className="discovery-badge">Unavailable</span>}
      <span className="track-duration">{track.duration ? formatTime(track.duration) : "—"}</span>
      {track.playable && <button className={liked ? "icon-button active" : "icon-button"} onClick={() => store.toggleLike(track.id)} aria-label={liked ? "Unlike" : "Like"}><Heart size={17} fill={liked ? "currentColor" : "none"} /></button>}
      {track.playable && <button className="icon-button" onClick={() => store.addToQueue(track)} aria-label="Add to queue"><ListPlus size={18} /></button>}
      {track.downloadUrl
        ? <a className="icon-button" href={track.downloadUrl} aria-label={`Download ${track.title} as MP3`} title="Download licensed MP3"><Download size={18} /></a>
        : <details className="track-menu"><summary role="button" className="icon-button" aria-label={`Add ${track.title} to a playlist`}><ListMusic size={18} /></summary><div>{localPlaylists.length ? localPlaylists.map((playlist) => <button key={playlist.id} disabled={playlist.trackIds.includes(track.id)} onClick={(event) => { store.addToPlaylist(playlist.id, track); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{playlist.trackIds.includes(track.id) ? "Added to " : "Add to "}{playlist.name}</button>) : <span>Create a playlist first</span>}</div></details>}
    </div>
  );
}
