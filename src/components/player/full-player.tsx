"use client";

import { ChevronDown, Download, Heart, ListMusic, Mic2, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { LyricsPanel } from "@/components/player/lyrics-panel";
import { usePlayerEngine, usePlayerProgress } from "@/components/player/player-engine";
import { PlayPauseIcon } from "@/components/player/play-pause-icon";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";
import { findKnownTrack, playerHref, selectCurrentTrack, usePlayerStore, useStoreHydrated } from "@/stores/player-store";

const SWIPE_DISTANCE = 80;

function FullTimeline() {
  const { duration, seek } = usePlayerEngine();
  const { currentTime } = usePlayerProgress();
  return <div className="full-timeline"><Slider aria-label="Seek track" value={[currentTime]} max={Math.max(duration, 1)} step={0.1} onValueChange={([value]) => seek(value)} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div>;
}

function LyricsSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const sheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>(".lyrics-sheet-close")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !sheet) return;
      // Keep keyboard focus inside the modal sheet.
      const focusable = [...sheet.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])")].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div className="lyrics-sheet-backdrop" onMouseDown={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.section ref={sheetRef} className="lyrics-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
        <button className="lyrics-sheet-close" onClick={onClose} aria-label="Close lyrics"><X /></button>
        {children}
      </motion.section>
    </motion.div>
  );
}

export function FullPlayerScreen() {
  const router = useRouter();
  const track = usePlayerStore(selectCurrentTrack);
  const store = usePlayerStore(useShallow((state) => ({
    isPlaying: state.isPlaying, shuffle: state.shuffle, repeat: state.repeat, likedIds: state.likedIds,
    toggleLike: state.toggleLike, toggleShuffle: state.toggleShuffle, previous: state.previous, pause: state.pause, resume: state.resume, next: state.next, cycleRepeat: state.cycleRepeat,
  })));
  const { loading, error } = usePlayerEngine();
  const [lyricsFor, setLyricsFor] = useState<string | null>(null);
  const lyricsButtonRef = useRef<HTMLButtonElement>(null);
  const lyricsOpen = Boolean(track && lyricsFor === track.id);
  const closeLyrics = useCallback(() => { setLyricsFor(null); lyricsButtonRef.current?.focus(); }, []);
  const minimize = () => { if (window.history.length > 1) router.back(); else router.push("/home"); };

  const hydrated = useStoreHydrated();
  const requestedId = useSearchParams().get("track");
  const localTracksLoaded = usePlayerStore((state) => state.localTracksLoaded);
  const requested = usePlayerStore((state) => requestedId ? findKnownTrack(state, requestedId) : undefined);
  // Device files load from IndexedDB after mount, so wait for them before giving up on a local id.
  const resolving = Boolean(requestedId && !requested && requestedId.startsWith("local:") && !localTracksLoaded);
  const missing = Boolean(hydrated && requestedId && !requested && !resolving);

  useEffect(() => {
    // Restore the track named in the URL after a reload or a shared link.
    if (hydrated && requested && selectCurrentTrack(usePlayerStore.getState())?.id !== requested.id) usePlayerStore.getState().cue(requested);
  }, [hydrated, requested]);

  const previousTrackId = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Keep the URL naming the current track so a reload restores it. On first render
    // only fill in a missing id, so a requested track isn't overwritten before it is cued.
    if (!hydrated || !track) return;
    const firstRender = previousTrackId.current === undefined;
    previousTrackId.current = track.id;
    if (track.id === requestedId || (firstRender && requestedId)) return;
    router.replace(playerHref(track), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, track?.id]);

  if (!hydrated || resolving || (!track && requested)) return <PageSkeleton />;
  if (!track || missing) return <div className="empty-state tall"><Play /><h2>{missing ? "This track isn’t on this device" : "Nothing playing"}</h2><p>{missing ? "Device files and tracks you haven’t played here can’t be restored from a link." : "Pick something to listen to."}</p><div className="collection-actions"><Link href="/home" className="action-chip">Go home</Link><Link href="/search" className="action-chip">Search music</Link></div></div>;
  const liked = store.likedIds.includes(track.id);
  const artwork = track.artwork || "/artwork/local.svg";
  const swipe = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE) store.next();
    else if (info.offset.x > SWIPE_DISTANCE) store.previous();
  };

  return (
    <motion.div className="full-player-layout" initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
      <section className="now-playing-panel">
        <AnimatePresence initial={false}>
          <motion.div key={track.id} className="fullscreen-glow" style={{ backgroundImage: `url(${artwork})` }} initial={{ opacity: 0 }} animate={{ opacity: 0.18 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />
        </AnimatePresence>
        <button className="icon-button full-player-minimize" onClick={minimize} aria-label="Minimize player"><ChevronDown /></button>
        <motion.div className="player-art-wrap" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.35} onDragEnd={swipe}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img key={track.id} src={artwork} alt={`${track.title} artwork`} draggable={false} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.3 }} />
          </AnimatePresence>
          <span>{track.source === "youtube" ? "YouTube audio" : track.source}</span>
        </motion.div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={track.id} className="full-track-copy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <span className="eyebrow">Now playing</span><h1>{track.title}</h1><p>{track.artist}{track.album ? ` · ${track.album}` : ""}</p>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>{error && <motion.p className="player-error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{error}</motion.p>}</AnimatePresence>
        <FullTimeline />
        <div className="full-controls">
          <button className={store.shuffle ? "icon-button active" : "icon-button"} onClick={store.toggleShuffle} aria-label="Shuffle" aria-pressed={store.shuffle}><Shuffle /></button>
          <button className="icon-button" onClick={store.previous} aria-label="Previous track"><SkipBack fill="currentColor" /></button>
          <motion.button whileTap={{ scale: 0.92 }} className="full-play-button" disabled={loading} onClick={store.isPlaying ? store.pause : store.resume} aria-label={loading ? "Loading audio" : store.isPlaying ? "Pause" : "Play"}><PlayPauseIcon playing={store.isPlaying} loading={loading} size={24} /></motion.button>
          <button className="icon-button" onClick={() => store.next()} aria-label="Next track"><SkipForward fill="currentColor" /></button>
          <button className={store.repeat !== "off" ? "icon-button active" : "icon-button"} onClick={store.cycleRepeat} aria-label={`Repeat ${store.repeat}`}>{store.repeat === "one" ? <Repeat1 /> : <Repeat />}</button>
        </div>
        <div className="full-player-actions">
          <button className={liked ? "action-chip active" : "action-chip"} onClick={() => store.toggleLike(track)} aria-pressed={liked}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {liked ? "Liked" : "Like"}</button>
          <button ref={lyricsButtonRef} className="action-chip" onClick={() => setLyricsFor(track.id)}><Mic2 size={17} /> Lyrics</button>
          {track.downloadUrl && <a className="action-chip" href={track.downloadUrl}><Download size={17} /> Download MP3</a>}
          <Link className="action-chip" href="/queue"><ListMusic size={17} /> Queue</Link>
        </div>
        {track.source !== "youtube" && <p className="source-note">{track.license?.name || "Source information unavailable"}</p>}
      </section>

      <AnimatePresence>
        {lyricsOpen && <LyricsSheet title={`Lyrics for ${track.title}`} onClose={closeLyrics}><LyricsPanel track={track} /></LyricsSheet>}
      </AnimatePresence>
    </motion.div>
  );
}
