"use client";

import { Heart, History, Library, ListMusic, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocalFilePicker } from "@/components/local-file-picker";
import { TrackRow } from "@/components/track-row";
import { usePlayerStore } from "@/stores/player-store";

export function LibraryScreen() {
  const synced = usePlayerStore((state) => state.syncedTracks);
  return <div className="page-stack"><section className="welcome-row"><div><span className="eyebrow"><Library size={14} /> Your music</span><h1>Add your own music</h1><p>Sync YouTube playlists from your profile or add private audio files from this device.</p></div></section>{synced.length > 0 && <section><div className="section-heading"><div><span className="eyebrow">YouTube sync</span><h2>From your Google account</h2><p>Playlist and liked-video metadata saved in this browser.</p></div></div><div className="track-list">{synced.map((track, index) => <TrackRow key={track.id} track={track} context={synced} index={index} />)}</div></section>}<LocalFilePicker /></div>;
}

export function LikedScreen() {
  const likedIds = usePlayerStore((state) => state.likedIds);
  const local = usePlayerStore((state) => state.localTracks);
  const history = usePlayerStore((state) => state.history);
  const synced = usePlayerStore((state) => state.syncedTracks);
  const tracks = [...history, ...local, ...synced].filter((track, index, all) => likedIds.includes(track.id) && all.findIndex((item) => item.id === track.id) === index);
  return <Collection title="Liked songs" subtitle="The tracks you keep coming back to." icon={<Heart />} tracks={tracks} />;
}

export function RecentScreen() {
  const tracks = usePlayerStore((state) => state.history);
  return <Collection title="Recently played" subtitle="Stored only in this browser." icon={<History />} tracks={tracks} />;
}

function Collection({ title, subtitle, icon, tracks }: { title: string; subtitle: string; icon: React.ReactNode; tracks: ReturnType<typeof usePlayerStore.getState>["history"] }) {
  return <div className="page-stack"><section className="collection-hero"><div>{icon}</div><span>Personal collection</span><h1>{title}</h1><p>{subtitle}</p></section>{tracks.length ? <div className="track-list">{tracks.map((track, index) => <TrackRow key={track.id} track={track} context={tracks} index={index} />)}</div> : <div className="empty-state"><Heart /><h3>Nothing here yet</h3><p>Use the heart button on a playable track to add it.</p></div>}</div>;
}

export function PlaylistsScreen() {
  const playlists = usePlayerStore((state) => state.playlists);
  const createPlaylist = usePlayerStore((state) => state.createPlaylist);
  const [name, setName] = useState("");
  const create = () => { if (name.trim()) { createPlaylist(name.trim()); setName(""); } };
  return <div className="page-stack"><div className="section-heading"><div><span className="eyebrow"><ListMusic size={14} /> Browser library</span><h1>Your playlists</h1><p>Local playlists and read-only copies synced from YouTube.</p></div></div><div className="create-playlist"><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} placeholder="Playlist name" maxLength={60} /><Button onClick={create}><Plus size={17} /> Create playlist</Button></div><div className="playlist-grid">{playlists.map((playlist, index) => <a href={`/playlist/${playlist.id}`} key={playlist.id} className="playlist-card"><span style={{ "--playlist-hue": `${75 + index * 24}deg` } as React.CSSProperties}><ListMusic /></span><strong>{playlist.name}</strong><small>{playlist.trackIds.length} tracks{playlist.source === "youtube" ? " · YouTube" : ""}</small></a>)}</div>{!playlists.length && <div className="empty-state"><ListMusic /><h3>Your first playlist starts here</h3><p>Name it above, then add tracks from their menus.</p></div>}</div>;
}
