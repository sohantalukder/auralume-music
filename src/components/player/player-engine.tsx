"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";
import { equalizerFrequencies } from "@/lib/customization";

type PlayerEngine = {
  duration: number;
  loading: boolean;
  error?: string;
  seek: (seconds: number) => void;
};

type PlayerProgress = {
  currentTime: number;
  buffered: number;
};

// Progress changes several times a second, so it lives in its own context to
// keep controls that only need duration/loading from re-rendering with it.
const PlayerEngineContext = createContext<PlayerEngine | null>(null);
const PlayerProgressContext = createContext<PlayerProgress | null>(null);

export function usePlayerEngine() {
  const value = useContext(PlayerEngineContext);
  if (!value) throw new Error("usePlayerEngine must be used inside PlayerEngineProvider");
  return value;
}

export function usePlayerProgress() {
  const value = useContext(PlayerProgressContext);
  if (!value) throw new Error("usePlayerProgress must be used inside PlayerEngineProvider");
  return value;
}

function updatePositionState(audio: HTMLAudioElement) {
  if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
  const duration = audio.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration, position: Math.min(audio.currentTime, duration), playbackRate: audio.playbackRate || 1 });
  } catch {
    // Some browsers reject transient states while a source is loading.
  }
}

export function PlayerEngineProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retryCountRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const current = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const equalizer = usePlayerStore((state) => state.equalizer);
  const pause = usePlayerStore((state) => state.pause);
  const next = usePlayerStore((state) => state.next);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // One element for every source: mobile browsers only keep playing (and allow
    // the next track to start) on the lock screen when the same element is reused.
    const audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;
    const time = () => {
      setCurrentTime(audio.currentTime || 0);
      setBuffered(audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0);
    };
    const metadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setLoading(false);
      updatePositionState(audio);
    };
    const position = () => updatePositionState(audio);
    const ended = () => {
      const before = selectCurrentTrack(usePlayerStore.getState())?.id;
      next("complete");
      const state = usePlayerStore.getState();
      // Repeat-one, or repeat-all on a one-track queue, keeps the same track, so
      // the src effect never re-runs; restart the element directly.
      if (state.isPlaying && selectCurrentTrack(state)?.id === before) {
        audio.currentTime = 0;
        void audio.play().catch(() => pause());
      }
    };
    const waiting = () => setLoading(true);
    const playing = () => { setLoading(false); setError(undefined); };
    const failed = () => {
      if (audio.error?.code === 1) return;
      const active = selectCurrentTrack(usePlayerStore.getState());
      if (active?.source === "youtube" && active.streamUrl && retryCountRef.current < 1) {
        retryCountRef.current += 1;
        const retryUrl = new URL(active.streamUrl, window.location.href);
        retryUrl.searchParams.set("retry", String(Date.now()));
        setError(undefined);
        setLoading(true);
        audio.src = retryUrl.href;
        audio.load();
        if (usePlayerStore.getState().isPlaying) void audio.play().catch(() => pause());
        return;
      }
      setLoading(false);
      setError(`"${active?.title ?? "This track"}" could not be played, so it was skipped.`);
      // Skip instead of stopping so one broken stream doesn't end a locked-screen session.
      const { queue, currentIndex, repeat, shuffle } = usePlayerStore.getState();
      if (queue.length > 1 && (shuffle || repeat === "all" || currentIndex + 1 < queue.length)) next("skip");
      else pause();
    };
    audio.addEventListener("timeupdate", time);
    audio.addEventListener("progress", time);
    audio.addEventListener("loadedmetadata", metadata);
    audio.addEventListener("seeked", position);
    audio.addEventListener("ratechange", position);
    audio.addEventListener("play", position);
    audio.addEventListener("ended", ended);
    audio.addEventListener("waiting", waiting);
    audio.addEventListener("playing", playing);
    audio.addEventListener("error", failed);
    return () => {
      audio.removeEventListener("timeupdate", time);
      audio.removeEventListener("progress", time);
      audio.removeEventListener("loadedmetadata", metadata);
      audio.removeEventListener("seeked", position);
      audio.removeEventListener("ratechange", position);
      audio.removeEventListener("play", position);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("waiting", waiting);
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("error", failed);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      filtersRef.current = [];
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [next, pause]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (equalizer.enabled && !audioContextRef.current) {
      try {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audio);
        const filters = equalizerFrequencies.map((frequency) => {
          const filter = context.createBiquadFilter();
          filter.type = "peaking";
          filter.frequency.value = frequency;
          filter.Q.value = 1;
          return filter;
        });
        source.connect(filters[0]);
        filters.forEach((filter, index) => filter.connect(filters[index + 1] ?? context.destination));
        audioContextRef.current = context;
        filtersRef.current = filters;
      } catch {
        filtersRef.current = [];
      }
    }
    filtersRef.current.forEach((filter, index) => { filter.gain.value = equalizer.enabled ? (equalizer.gains[index] ?? 0) : 0; });
    if (isPlaying) void audioContextRef.current?.resume().catch(() => undefined);
  }, [equalizer, isPlaying]);

  useEffect(() => {
    // Once audio is routed through Web Audio, a suspended context (iOS does this on
    // lock or interruption) silences playback, so resume it whenever we should be playing.
    const resumeContext = () => {
      const context = audioContextRef.current;
      if (context && context.state !== "running" && context.state !== "closed" && usePlayerStore.getState().isPlaying) {
        void context.resume().catch(() => undefined);
      }
    };
    const context = audioContextRef.current;
    context?.addEventListener("statechange", resumeContext);
    document.addEventListener("visibilitychange", resumeContext);
    return () => {
      context?.removeEventListener("statechange", resumeContext);
      document.removeEventListener("visibilitychange", resumeContext);
    };
  }, [equalizer.enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    let resetFrame: number | undefined;
    if (!current.streamUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      resetFrame = window.requestAnimationFrame(() => {
        setCurrentTime(0);
        setDuration(current.duration ?? 0);
        setBuffered(0);
        setLoading(false);
        setError(undefined);
      });
    } else if (audio.src !== new URL(current.streamUrl, window.location.href).href) {
      retryCountRef.current = 0;
      audio.src = current.streamUrl;
      audio.load();
      setCurrentTime(0);
      setBuffered(0);
      setDuration(current.duration ?? 0);
      setLoading(true);
    }
    if ("mediaSession" in navigator) {
      const artwork = current.artwork ? new URL(current.artwork, window.location.href).href : undefined;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album,
        artwork: artwork ? [{ src: artwork, sizes: "512x512" }] : undefined,
      });
    }
    return () => { if (resetFrame !== undefined) window.cancelAnimationFrame(resetFrame); };
  }, [current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    if (!current.streamUrl) {
      audio.pause();
      return;
    }
    if (isPlaying) audio.play().catch((cause: unknown) => {
      // AbortError means a newer src replaced this one; the next play() call handles it.
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Press play to start audio in this browser.");
      pause();
    });
    else audio.pause();
  }, [current, isPlaying, pause]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [volume, muted]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const audio = () => audioRef.current;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => usePlayerStore.getState().resume()],
      ["pause", () => usePlayerStore.getState().pause()],
      ["nexttrack", () => usePlayerStore.getState().next()],
      ["previoustrack", () => usePlayerStore.getState().previous()],
      ["seekbackward", (details) => { const element = audio(); if (element) seek(element.currentTime - (details.seekOffset ?? 10)); }],
      ["seekforward", (details) => { const element = audio(); if (element) seek(element.currentTime + (details.seekOffset ?? 10)); }],
      ["seekto", (details) => { if (details.seekTime !== undefined) seek(details.seekTime); }],
    ];
    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
    }
    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, [seek]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select, button, [role=slider], [contenteditable=true]")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (usePlayerStore.getState().isPlaying) usePlayerStore.getState().pause();
        else usePlayerStore.getState().resume();
      }
      const element = audioRef.current;
      if (!element || !event.altKey) return;
      if (event.code === "ArrowRight") seek(element.currentTime + 10);
      if (event.code === "ArrowLeft") seek(element.currentTime - 10);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [seek]);

  const engine = useMemo(() => ({ duration, loading, error, seek }), [duration, error, loading, seek]);
  const progress = useMemo(() => ({ currentTime, buffered }), [buffered, currentTime]);
  return (
    <PlayerEngineContext.Provider value={engine}>
      <PlayerProgressContext.Provider value={progress}>{children}</PlayerProgressContext.Provider>
    </PlayerEngineContext.Provider>
  );
}
