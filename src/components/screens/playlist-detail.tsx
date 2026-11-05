"use client";

import { ArrowDown, ArrowUp, ListMusic, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrackRow } from "@/components/track-row";
import { Button } from "@/components/ui/button";
import type { Track } from "@/lib/types";
import { usePlayerStore } from "@/stores/player-store";

export function PlaylistDetail({ id }: { id: string }) {
  const router = useRouter();
  const playlist = usePlayerStore((state) => state.playlists.find((item) => item.id === id));
  const local = usePlayerStore((state) => state.localTracks);
  const history = usePlayerStore((state) => state.history);
  const synced = usePlayerStore((state) => state.syncedTracks);
  const rename = usePlayerStore((state) => state.renamePlaylist);
  const deletePlaylist = usePlayerStore((state) => state.deletePlaylist);
  const removeTrack = usePlayerStore((state) => state.removeFromPlaylist);
  const moveTrack = usePlayerStore((state) => state.movePlaylistTrack);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist?.name ?? "");

  if (!playlist) return <div className="empty-state tall"><ListMusic /><h2>Playlist not found</h2><p>This browser does not have that playlist.</p></div>;

  const catalog = new Map<string, Track>([...(playlist.tracks ?? []), ...history, ...synced, ...local].map((track) => [track.id, track]));
  const tracks = playlist.trackIds.map((trackId) => catalog.get(trackId)).filter((track): track is Track => Boolean(track));
  const saveName = () => { rename(id, name); setEditing(false); };
  const removePlaylist = () => { deletePlaylist(id); router.push("/playlists"); };

  return <div className="page-stack"><section className="collection-hero"><div><ListMusic /></div><span>{playlist.source === "youtube" ? "Synced from YouTube" : "Private playlist"}</span>{editing ? <div className="playlist-edit"><label className="sr-only" htmlFor="playlist-name">Playlist name</label><input id="playlist-name" value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveName()} /><Button size="sm" onClick={saveName}>Save</Button></div> : <h1>{playlist.name}</h1>}<p>{playlist.description} · {tracks.length} tracks</p>{playlist.source !== "youtube" && <div className="collection-actions"><Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil size={15} /> Rename</Button><Button variant="danger" size="sm" onClick={removePlaylist}><Trash2 size={15} /> Delete</Button></div>}</section>{tracks.length ? <div className="playlist-track-list">{tracks.map((track, index) => <div className="playlist-track" key={track.id}><TrackRow track={track} context={tracks} index={index} />{playlist.source !== "youtube" && <div className="playlist-track-actions"><button className="icon-button" disabled={index === 0} onClick={() => moveTrack(id, index, index - 1)} aria-label={`Move ${track.title} up`}><ArrowUp size={16} /></button><button className="icon-button" disabled={index === tracks.length - 1} onClick={() => moveTrack(id, index, index + 1)} aria-label={`Move ${track.title} down`}><ArrowDown size={16} /></button><button className="icon-button danger-icon" onClick={() => removeTrack(id, track.id)} aria-label={`Remove ${track.title} from playlist`}><Trash2 size={16} /></button></div>}</div>)}</div> : <div className="empty-state"><ListMusic /><h3>This playlist is empty</h3><p>{playlist.source === "youtube" ? "Sync again from your profile to refresh it." : "Add tracks from the playlist button on any result."}</p></div>}</div>;
}
