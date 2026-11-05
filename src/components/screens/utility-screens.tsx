"use client";

import { ArrowDown, ArrowUp, Check, Info, ListMusic, LogIn, LogOut, RefreshCw, ShieldCheck, Trash2, User, Youtube } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProfileSkeleton, Skeleton } from "@/components/ui/skeleton";
import { TrackRow } from "@/components/track-row";
import { APP_NAME } from "@/lib/brand";
import { clearLocalAudio } from "@/lib/local-audio";
import type { YouTubeLibrary } from "@/lib/types";
import { usePlayerStore } from "@/stores/player-store";

export function QueueScreen() {
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const remove = usePlayerStore((state) => state.removeFromQueue);
  const move = usePlayerStore((state) => state.moveQueueItem);
  return <div className="page-stack"><div className="section-heading"><div><span className="eyebrow"><ListMusic size={14} /> Up next</span><h1>Queue</h1><p>{queue.length ? `${queue.length} tracks · ${Math.max(queue.length - currentIndex - 1, 0)} remaining` : "Choose a track to begin."}</p></div></div>{queue.length ? <div className="queue-list">{queue.map((track, index) => <div className={index === currentIndex ? "queue-item current" : "queue-item"} key={`${track.id}-${index}`}><div className="queue-order"><button disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${track.title} up`}><ArrowUp size={14} /></button><button disabled={index === queue.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${track.title} down`}><ArrowDown size={14} /></button></div><TrackRow track={track} context={queue} index={index} /><button className="icon-button" onClick={() => remove(index)} aria-label={`Remove ${track.title} from queue`}><Trash2 size={17} /></button></div>)}</div> : <div className="empty-state"><ListMusic /><h3>The queue is quiet</h3><p>Choose a track, then add more with the queue button.</p></div>}</div>;
}

export function ProfileScreen() {
  const { data: session, status } = useSession();
  const liked = usePlayerStore((state) => state.likedIds.length);
  const history = usePlayerStore((state) => state.history.length);
  const local = usePlayerStore((state) => state.localTracks.length);
  const synced = usePlayerStore((state) => state.syncedTracks.length);
  const syncedPlaylists = usePlayerStore((state) => state.playlists.filter((playlist) => playlist.source === "youtube").length);
  const syncYouTubeLibrary = usePlayerStore((state) => state.syncYouTubeLibrary);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const sync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/youtube/library");
      const body = await response.json() as { data?: YouTubeLibrary; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message || "YouTube sync failed.");
      syncYouTubeLibrary(body.data.tracks, body.data.playlists);
      setMessage(`Synced ${body.data.tracks.length} tracks from ${body.data.playlists.length} playlists.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "YouTube sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  if (status === "loading") return <ProfileSkeleton />;
  return <div className="page-stack profile-page"><section className="profile-card"><div className="profile-avatar">{session?.user?.image ? <img src={session.user.image} alt="" referrerPolicy="no-referrer" /> : <User />}</div><span>{session?.user ? "Google listener" : "Personal listener"}</span><h1>{session?.user?.name || "Your private listening space"}</h1><p>{session?.user?.email || `${local} optional local tracks · ${liked} likes · ${history} recent plays. Your preferences stay in this browser.`}</p>{session?.user ? <div className="profile-actions"><Button onClick={sync} disabled={syncing}>{syncing ? <Skeleton className="skeleton-inline" /> : <RefreshCw />} {syncing ? "Syncing library…" : "Sync YouTube library"}</Button><Button variant="secondary" onClick={() => signOut({ callbackUrl: "/home" })}><LogOut /> Sign out</Button></div> : <Button className="google-sign-in-button" onClick={() => signIn("google", { callbackUrl: "/profile" })}><LogIn /> Continue with Google</Button>}</section>{session?.user && <section className="youtube-sync-card"><div><Youtube /><span><strong>YouTube library</strong><small>{synced} tracks · {syncedPlaylists} playlists saved in this browser</small></span></div><p>Sync imports your YouTube playlists and liked videos using read-only access. Google does not provide a separate API for full YouTube Music history.</p>{message && <div className="form-message" role="status">{message}</div>}</section>}</div>;
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
  return <div className="page-stack privacy-page"><span className="eyebrow"><ShieldCheck size={14} /> Privacy controls</span><h1>Private personalization, transparent sources.</h1><section><h2>Online music</h2><p>Search terms and catalog requests are sent to YouTube and the Internet Archive. Online playback uses those providers; {APP_NAME} does not store their audio files.</p></section><section><h2>Google and YouTube sync</h2><p>Google sign-in requests read-only YouTube access. {APP_NAME} reads playlists and liked videos only when you press sync, then stores the imported track metadata in this browser. Google credentials stay in an encrypted, HTTP-only session cookie. {APP_NAME} settings and playlists do not sync across devices.</p></section><section><h2>Optional device music</h2><p>MP3, AAC, WAV, and OGG files you choose are stored in this browser’s IndexedDB only. {APP_NAME} has no music-upload server.</p></section><section><h2>Lyrics</h2><p>When you open lyrics, track title and artist metadata are sent to LRCLIB for lookup. Local audio bytes never leave this browser.</p></section><section><h2>Personalization</h2><p>Searches, likes, plays, skips, preferences, and recommendations stay in this browser. Clearing site storage removes them.</p></section><div className="danger-zone"><div><Info /><span><strong>Clear this browser</strong><small>Removes local files, likes, playlists, synced YouTube metadata, queue, history, settings, and recommendation data.</small></span></div><Button variant="danger" disabled={status === "clearing"} onClick={erase}>{status === "clearing" ? <><Skeleton className="skeleton-inline" /> Clearing…</> : status === "cleared" ? <><Check /> Cleared</> : <><Trash2 /> {status === "error" ? "Retry clearing" : "Clear local data"}</>}</Button></div>{status === "error" && <div className="form-message source-error" role="alert">Some browser data could not be cleared. Nothing is reported as complete; retry the operation.</div>}</div>;
}
