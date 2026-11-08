"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { TrackListSkeleton } from "@/components/ui/skeleton";
import { fetchYouTubeSearch } from "@/lib/search-client";
import type { Track } from "@/lib/types";
import { usePlayerStore } from "@/stores/player-store";

/**
 * iOS "Add Music" flow inside a playlist: search or browse your library and tap + to add,
 * without leaving the playlist to hunt through track menus.
 */
export function AddSongsPanel({ playlistId, onClose }: { playlistId: string; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const addedIds = usePlayerStore(useShallow((state) => state.playlists.find((playlist) => playlist.id === playlistId)?.trackIds ?? []));
  const addToPlaylist = usePlayerStore((state) => state.addToPlaylist);
  const { history, liked, local } = usePlayerStore(useShallow((state) => ({ history: state.history, liked: state.likedTracks, local: state.localTracks })));

  useEffect(() => {
    // Search once typing pauses instead of on every keystroke.
    const timer = window.setTimeout(() => setQuery(input.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [input]);

  const search = useQuery({
    queryKey: ["add-songs", query],
    queryFn: ({ signal }) => fetchYouTubeSearch(query, signal),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
  const library = useMemo(() => {
    const seen = new Set<string>();
    return [...local, ...liked, ...history].filter((track) => track.playable && !seen.has(track.id) && seen.add(track.id));
  }, [history, liked, local]);
  const needle = input.trim().toLocaleLowerCase();
  const libraryMatches = needle ? library.filter((track) => `${track.title} ${track.artist}`.toLocaleLowerCase().includes(needle)) : library;
  const results = query.length >= 2 ? [...libraryMatches.slice(0, 5), ...(search.data ?? []).filter((track) => track.playable && !libraryMatches.some((item) => item.id === track.id))] : libraryMatches;

  return (
    <section className="add-songs" aria-label="Add songs">
      <div className="add-songs-bar">
        <label className="add-songs-search"><Search size={17} /><span className="sr-only">Search songs to add</span><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} placeholder="Search songs, artists" /></label>
        <button className="add-songs-done" onClick={onClose}>Done</button>
      </div>
      {!query && <p className="add-songs-hint">{library.length ? "From your library" : "Search to find songs"}</p>}
      {query.length >= 2 && search.isFetching && !results.length && <TrackListSkeleton rows={4} label="Searching songs" />}
      {search.isError && <p className="add-songs-hint">Search is unavailable right now. Try again in a moment.</p>}
      {results.length > 0 && <ul className="add-songs-list">{results.slice(0, 25).map((track) => <AddRow key={track.id} track={track} added={addedIds.includes(track.id)} onAdd={() => addToPlaylist(playlistId, track)} />)}</ul>}
      {query.length >= 2 && !search.isFetching && !results.length && !search.isError && <p className="add-songs-hint">No songs found for “{query}”.</p>}
    </section>
  );
}

function AddRow({ track, added, onAdd }: { track: Track; added: boolean; onAdd: () => void }) {
  return <li>
    <img src={track.artwork || "/artwork/local.svg"} alt="" />
    <div><strong>{track.title}</strong><span>{track.artist}</span></div>
    <button className={added ? "add-song-button added" : "add-song-button"} onClick={onAdd} disabled={added} aria-label={added ? `${track.title} added` : `Add ${track.title}`}>{added ? <Check size={18} /> : <Plus size={18} />}</button>
  </li>;
}
