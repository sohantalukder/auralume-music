"use client";

import { Check, Download, Heart, ListMusic, ListPlus, MoreHorizontal, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import type { Track } from "@/lib/types";
import { usePlayerStore } from "@/stores/player-store";

/**
 * The single "⋯" action menu for a track (queue, like, playlists, download), replacing
 * per-row buttons that hid "Add to playlist" whenever a track was downloadable.
 */
export function TrackMenu({ track, extra }: { track: Track; extra?: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const liked = usePlayerStore((state) => state.likedIds.includes(track.id));
  const playlists = usePlayerStore(useShallow((state) => state.playlists.filter((playlist) => playlist.source !== "youtube")));
  const actions = usePlayerStore(useShallow((state) => ({ addToQueue: state.addToQueue, toggleLike: state.toggleLike, addToPlaylist: state.addToPlaylist, createPlaylist: state.createPlaylist })));
  const close = () => { setOpen(false); setNaming(false); setName(""); };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    // Follow the button on scroll (layout shifts also fire scroll events); close only once it leaves the screen.
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) close(); else place();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // The panel renders in a portal (so lists with overflow:hidden can't clip it) and is
  // placed next to its button, flipping upward when there isn't room below.
  function place() {
    const button = rootRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!button || !panel) return;
    const gap = 6;
    const height = panel.offsetHeight;
    const width = panel.offsetWidth;
    const below = window.innerHeight - button.bottom;
    const top = below >= height + gap || below >= button.top ? button.bottom + gap : Math.max(gap, button.top - height - gap);
    const left = Math.min(Math.max(gap, button.right - width), window.innerWidth - width - gap);
    setPosition({ top, left });
  }
  useLayoutEffect(() => { if (open) place(); }, [open, naming, playlists.length]);

  const toggle = () => { if (open) close(); else { setPosition({ visibility: "hidden" }); setOpen(true); } };
  const createAndAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    actions.addToPlaylist(actions.createPlaylist(trimmed), track);
    close();
  };

  return (
    <div className="track-menu" ref={rootRef}>
      <button className="icon-button" onClick={toggle} aria-label={`More options for ${track.title}`} aria-haspopup="menu" aria-expanded={open}><MoreHorizontal size={18} /></button>
      {typeof document !== "undefined" && createPortal(<AnimatePresence>
        {open && <motion.div ref={panelRef} role="menu" aria-label={`Options for ${track.title}`} className="track-menu-panel" style={position} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.12 }}>
          {track.playable && <button role="menuitem" onClick={() => { actions.addToQueue(track); close(); }}><ListPlus size={16} /> Add to queue</button>}
          {track.playable && <button role="menuitem" onClick={() => { actions.toggleLike(track); close(); }}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Remove from liked" : "Like"}</button>}
          {track.downloadUrl && <a role="menuitem" href={track.downloadUrl} onClick={close}><Download size={16} /> Download MP3</a>}
          <div className="track-menu-section" role="presentation">Add to playlist</div>
          {playlists.map((playlist) => {
            const added = playlist.trackIds.includes(track.id);
            return <button role="menuitem" key={playlist.id} disabled={added} onClick={() => { actions.addToPlaylist(playlist.id, track); close(); }} aria-label={`${added ? "Added to" : "Add to"} ${playlist.name}`}>{added ? <Check size={16} /> : <ListMusic size={16} />} {playlist.name}</button>;
          })}
          {naming
            ? <form className="track-menu-new" onSubmit={(event) => { event.preventDefault(); createAndAdd(); }}><input autoFocus aria-label="New playlist name" placeholder="Playlist name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /><button type="submit" disabled={!name.trim()}>Add</button></form>
            : <button role="menuitem" className="accent" onClick={() => setNaming(true)}><Plus size={16} /> New playlist…</button>}
          {extra?.(close)}
        </motion.div>}
      </AnimatePresence>, document.body)}
    </div>
  );
}
