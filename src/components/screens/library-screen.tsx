"use client";

import { ChevronRight, Heart, History, ListMusic, ListOrdered, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocalFilePicker } from "@/components/local-file-picker";
import { PlaylistCover } from "@/components/playlist-cover";
import { TrackRow } from "@/components/track-row";
import type { Track } from "@/lib/types";
import { usePlayerStore } from "@/stores/player-store";

const libraryLinks = [
  { href: "/playlists", label: "Playlists", icon: ListMusic },
  { href: "/liked", label: "Liked songs", icon: Heart },
  { href: "/recent", label: "Recently played", icon: History },
  { href: "/queue", label: "Queue", icon: ListOrdered },
];

export function LibraryScreen() {
  return <div className="page-stack"><section className="welcome-row"><div><h1>Library</h1></div></section><nav className="grouped-list" aria-label="Library">{libraryLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href}><Icon size={20} /><span>{label}</span><ChevronRight size={18} className="grouped-chevron" /></Link>)}</nav><LocalFilePicker /></div>;
}

export function LikedScreen() {
  const liked = usePlayerStore((state) => state.likedTracks);
  const local = usePlayerStore((state) => state.localTracks);
  // Local snapshots lose their blob URL on reload; swap in the live IndexedDB track when present.
  const tracks = liked.map((track) => local.find((item) => item.id === track.id) ?? track);
  return <Collection title="Liked songs" subtitle="The tracks you keep coming back to." icon={<Heart />} tracks={tracks} empty="Use the heart button on a playable track to add it." />;
}

export function RecentScreen() {
  const tracks = usePlayerStore((state) => state.history);
  return <Collection title="Recently played" subtitle="Stored only in this browser." icon={<History />} tracks={tracks} empty="Tracks you play will show up here." />;
}

function Collection({ title, subtitle, icon, tracks, empty }: { title: string; subtitle: string; icon: React.ReactNode; tracks: Track[]; empty: string }) {
  return <div className="page-stack"><section className="collection-hero"><div>{icon}</div><span>Personal collection</span><h1>{title}</h1><p>{subtitle}</p></section>{tracks.length ? <div className="track-list">{tracks.map((track, index) => <TrackRow key={track.id} track={track} context={tracks} index={index} />)}</div> : <div className="empty-state">{icon}<h3>Nothing here yet</h3><p>{empty}</p></div>}</div>;
}

export function PlaylistsScreen() {
  const playlists = usePlayerStore((state) => state.playlists);
  const createPlaylist = usePlayerStore((state) => state.createPlaylist);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const create = () => { if (!name.trim()) return; createPlaylist(name); setName(""); setCreating(false); };
  return <div className="page-stack">
    <section className="welcome-row"><div><h1>Playlists</h1></div></section>
    {creating
      ? <form className="new-playlist-form" onSubmit={(event) => { event.preventDefault(); create(); }}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setCreating(false); }} placeholder="Playlist name" aria-label="Playlist name" maxLength={60} /><Button type="submit" disabled={!name.trim()}>Create playlist</Button><Button type="button" variant="ghost" onClick={() => { setCreating(false); setName(""); }}>Cancel</Button></form>
      : <button className="new-playlist-row" onClick={() => setCreating(true)}><span><Plus size={22} /></span>New playlist</button>}
    {playlists.length > 0
      ? <div className="playlist-grid">{playlists.map((playlist) => <Link href={`/playlist/${playlist.id}`} key={playlist.id} className="playlist-card"><PlaylistCover tracks={playlist.tracks ?? []} /><strong>{playlist.name}</strong><small>{playlist.trackIds.length} {playlist.trackIds.length === 1 ? "song" : "songs"}</small></Link>)}</div>
      : !creating && <div className="empty-state"><ListMusic /><h3>No playlists yet</h3><p>Create one, then add songs from any track’s ⋯ menu.</p></div>}
  </div>;
}
