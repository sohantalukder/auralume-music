"use client";

import { ArrowDown, ArrowUp, ListMusic, Pencil, Play, Plus, Shuffle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useState } from "react";
import { AddSongsPanel } from "@/components/add-songs-panel";
import { PlaylistCover } from "@/components/playlist-cover";
import { TrackRow } from "@/components/track-row";
import { Button } from "@/components/ui/button";
import type { Track } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";
import { usePlayerStore, useStoreHydrated } from "@/stores/player-store";

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function PlaylistDetail({ id }: { id: string }) {
  const router = useRouter();
  const playlist = usePlayerStore((state) => state.playlists.find((item) => item.id === id));
  const local = usePlayerStore((state) => state.localTracks);
  const history = usePlayerStore((state) => state.history);
  const synced = usePlayerStore((state) => state.syncedTracks);
  const play = usePlayerStore((state) => state.play);
  const rename = usePlayerStore((state) => state.renamePlaylist);
  const deletePlaylist = usePlayerStore((state) => state.deletePlaylist);
  const removeTrack = usePlayerStore((state) => state.removeFromPlaylist);
  const moveTrack = usePlayerStore((state) => state.movePlaylistTrack);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const hydrated = useStoreHydrated();

  if (!hydrated) return <PageSkeleton />;
  if (!playlist) return <div className="empty-state tall"><ListMusic /><h2>Playlist not found</h2><p>This browser does not have that playlist.</p><div className="collection-actions"><Link href="/playlists" className="action-chip">All playlists</Link></div></div>;

  // Live library copies come last so a local file's playable blob URL wins over its snapshot.
  const catalog = new Map<string, Track>([...(playlist.tracks ?? []), ...history, ...synced, ...local].map((track) => [track.id, track]));
  const tracks = playlist.trackIds.map((trackId) => catalog.get(trackId)).filter((track): track is Track => Boolean(track));
  const playable = tracks.filter((track) => track.playable);
  const totalSeconds = tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  const editable = playlist.source !== "youtube";
  const saveName = () => { rename(id, name); setEditing(false); };
  const removePlaylist = () => { deletePlaylist(id); router.push("/playlists"); };
  const shuffle = () => {
    if (!playable.length) return;
    usePlayerStore.setState({ shuffle: true });
    play(pickRandom(playable), playable);
  };

  return <div className="page-stack">
    <section className="playlist-header">
      <PlaylistCover tracks={tracks} className="large" />
      <div className="playlist-header-copy">
        <span className="eyebrow">Playlist</span>
        {editing
          ? <form className="playlist-edit" onSubmit={(event) => { event.preventDefault(); saveName(); }}><label className="sr-only" htmlFor="playlist-name">Playlist name</label><input id="playlist-name" value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} /><Button size="sm" type="submit">Save</Button><Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></form>
          : <h1>{playlist.name}</h1>}
        <p>{tracks.length} {tracks.length === 1 ? "song" : "songs"}{totalSeconds > 0 ? ` · ${formatTime(totalSeconds)}` : ""}</p>
        <div className="playlist-actions">
          <Button onClick={() => playable[0] && play(playable[0], playable)} disabled={!playable.length}><Play size={16} fill="currentColor" /> Play</Button>
          <Button variant="secondary" onClick={shuffle} disabled={!playable.length}><Shuffle size={16} /> Shuffle</Button>
          {editable && <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} /> Add songs</Button>}
          {editable && <Button variant="ghost" size="sm" onClick={() => { setName(playlist.name); setEditing(true); }}><Pencil size={15} /> Rename</Button>}
          {editable && (confirmDelete
            ? <><Button variant="danger" size="sm" onClick={removePlaylist}><Trash2 size={15} /> Delete playlist</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button></>
            : <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete</Button>)}
        </div>
      </div>
    </section>
    {adding && <AddSongsPanel playlistId={id} onClose={() => setAdding(false)} />}
    {tracks.length
      ? <div className="track-list">{tracks.map((track, index) => <motion.div layout="position" transition={{ duration: 0.2 }} key={track.id}>
          <TrackRow track={track} context={playable} index={index} menuExtra={editable ? (close) => <>
            <div className="track-menu-section" role="presentation">This playlist</div>
            {index > 0 && <button role="menuitem" onClick={() => { moveTrack(id, index, index - 1); close(); }}><ArrowUp size={16} /> Move up</button>}
            {index < tracks.length - 1 && <button role="menuitem" onClick={() => { moveTrack(id, index, index + 1); close(); }}><ArrowDown size={16} /> Move down</button>}
            <button role="menuitem" className="danger" onClick={() => { removeTrack(id, track.id); close(); }}><Trash2 size={16} /> Remove from playlist</button>
          </> : undefined} />
        </motion.div>)}</div>
      : !adding && <div className="empty-state"><ListMusic /><h3>This playlist is empty</h3><p>Search for songs or pick from your library.</p>{editable && <div className="collection-actions"><Button onClick={() => setAdding(true)}><Plus size={16} /> Add songs</Button></div>}</div>}
  </div>;
}
