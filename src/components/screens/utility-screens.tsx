"use client";

import { ArrowDown, ArrowUp, Check, Info, ListMusic, ShieldCheck, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackRow } from "@/components/track-row";
import { APP_NAME } from "@/lib/brand";
import { clearLocalAudio } from "@/lib/local-audio";
import { usePlayerStore } from "@/stores/player-store";

export function QueueScreen() {
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const remove = usePlayerStore((state) => state.removeFromQueue);
  const move = usePlayerStore((state) => state.moveQueueItem);
  // The same track can be queued twice, so key each entry by id plus occurrence
  // instead of position; keys then follow items when they are reordered.
  const seen = new Map<string, number>();
  const queueKeys = queue.map((track) => {
    const occurrence = seen.get(track.id) ?? 0;
    seen.set(track.id, occurrence + 1);
    return `${track.id}#${occurrence}`;
  });
  return <div className="page-stack"><div className="section-heading"><div><span className="eyebrow"><ListMusic size={14} /> Up next</span><h1>Queue</h1><p>{queue.length ? `${queue.length} tracks · ${Math.max(queue.length - currentIndex - 1, 0)} remaining` : "Choose a track to begin."}</p></div></div>{queue.length ? <div className="queue-list">{queue.map((track, index) => <motion.div layout="position" transition={{ duration: 0.2 }} className={index === currentIndex ? "queue-item current" : "queue-item"} key={queueKeys[index]}><div className="queue-order"><button disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${track.title} up`}><ArrowUp size={14} /></button><button disabled={index === queue.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${track.title} down`}><ArrowDown size={14} /></button></div><TrackRow track={track} context={queue} index={index} /><button className="icon-button" onClick={() => remove(index)} aria-label={`Remove ${track.title} from queue`}><Trash2 size={17} /></button></motion.div>)}</div> : <div className="empty-state"><ListMusic /><h3>The queue is quiet</h3><p>Choose a track, then add more with the queue button.</p></div>}</div>;
}

export function PrivacyScreen() {
  const clear = usePlayerStore((state) => state.clearPersonalData);
  const [status, setStatus] = useState<"idle" | "clearing" | "cleared" | "error">("idle");
  const erase = async () => {
    setStatus("clearing");
    try {
      await Promise.all([clear(), clearLocalAudio()]);
      localStorage.removeItem("aura-library-v1");
      setStatus("cleared");
    } catch { setStatus("error"); }
  };
  return <div className="page-stack privacy-page"><span className="eyebrow"><ShieldCheck size={14} /> Privacy controls</span><h1>Private personalization, transparent sources.</h1><section><h2>Online music</h2><p>Search terms and catalog requests are sent to YouTube and the Internet Archive. Online playback uses those providers; {APP_NAME} does not store their audio files.</p></section><section><h2>No account needed</h2><p>{APP_NAME} has no sign-in. Settings, likes, and playlists stay in this browser and do not sync across devices.</p></section><section><h2>Optional device music</h2><p>MP3, AAC, WAV, and OGG files you choose are stored in this browser’s IndexedDB only. {APP_NAME} has no music-upload server.</p></section><section><h2>Lyrics</h2><p>When you open lyrics, track title and artist metadata are sent to LRCLIB for lookup. Local audio bytes never leave this browser.</p></section><section><h2>Personalization</h2><p>Searches, likes, plays, skips, preferences, and recommendations stay in this browser. Clearing site storage removes them.</p></section><div className="danger-zone"><div><Info /><span><strong>Clear this browser</strong><small>Removes local files, likes, playlists, queue, history, settings, and recommendation data.</small></span></div><Button variant="danger" disabled={status === "clearing"} onClick={erase}>{status === "clearing" ? <><Skeleton className="skeleton-inline" /> Clearing…</> : status === "cleared" ? <><Check /> Cleared</> : <><Trash2 /> {status === "error" ? "Retry clearing" : "Clear local data"}</>}</Button></div>{status === "error" && <div className="form-message source-error" role="alert">Some browser data could not be cleared. Nothing is reported as complete; retry the operation.</div>}</div>;
}
