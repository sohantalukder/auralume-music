"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Mic2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { activeLyricIndex, parseSyncedLyrics } from "@/lib/lyrics";
import type { LyricsResult, Track } from "@/lib/types";
import { LyricsSkeleton } from "@/components/ui/skeleton";

async function fetchLyrics(track: Track, signal: AbortSignal): Promise<LyricsResult> {
  const params = new URLSearchParams({ title: track.title, artist: track.artist });
  if (track.album) params.set("album", track.album);
  if (track.duration) params.set("duration", String(Math.round(track.duration)));
  const response = await fetch(`/api/lyrics?${params}`, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Lyrics are unavailable.");
  return body;
}

export function LyricsPanel({ track, currentTime, onSeek }: { track: Track; currentTime: number; onSeek: (seconds: number) => void }) {
  const lyrics = useQuery({
    queryKey: ["lyrics", track.id, track.title, track.artist],
    queryFn: ({ signal }) => fetchLyrics(track, signal),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  const lines = useMemo(() => parseSyncedLyrics(lyrics.data?.syncedLyrics), [lyrics.data?.syncedLyrics]);
  const active = activeLyricIndex(lines, currentTime);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [active]);

  return (
    <section className="lyrics-panel" aria-label="Lyrics">
      <header><div><span className="eyebrow"><Mic2 size={14} /> Lyrics</span><h2>Follow every line</h2></div>{lyrics.data && <a href={lyrics.data.sourceUrl} target="_blank" rel="noreferrer">LRCLIB <ExternalLink size={13} /></a>}</header>
      {lyrics.isLoading && <LyricsSkeleton />}
      {lyrics.isError && <div className="lyrics-state"><Mic2 /><strong>Lyrics unavailable</strong><p>{lyrics.error.message}</p></div>}
      {lyrics.data?.instrumental && <div className="lyrics-state"><Mic2 /><strong>Instrumental track</strong><p>There are no vocal lyrics for this recording.</p></div>}
      {lyrics.data && !lyrics.data.instrumental && lines.length > 0 && <div className="synced-lyrics" aria-live="off">{lines.map((line, index) => <button key={`${line.time}-${index}`} ref={index === active ? activeRef : undefined} className={index === active ? "active" : index < active ? "past" : ""} onClick={() => onSeek(line.time)}>{line.text}</button>)}</div>}
      {lyrics.data && !lyrics.data.instrumental && !lines.length && lyrics.data.plainLyrics && <div className="plain-lyrics">{lyrics.data.plainLyrics}</div>}
      {lyrics.data && !lyrics.data.instrumental && !lines.length && !lyrics.data.plainLyrics && <div className="lyrics-state"><Mic2 /><strong>No lyrics found</strong><p>Try another recording or check again later.</p></div>}
    </section>
  );
}
