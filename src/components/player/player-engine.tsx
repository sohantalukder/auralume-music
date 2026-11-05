"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";
import { equalizerFrequencies } from "@/lib/customization";

type PlayerEngine = {
  currentTime: number;
  duration: number;
  buffered: number;
  loading: boolean;
  error?: string;
  seek: (seconds: number) => void;
};

const PlayerEngineContext = createContext<PlayerEngine | null>(null);

export function usePlayerEngine() {
  const value = useContext(PlayerEngineContext);
  if (!value) throw new Error("usePlayerEngine must be used inside PlayerEngineProvider");
  return value;
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
    const audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;
    const time = () => {
      setCurrentTime(audio.currentTime || 0);
      setBuffered(audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0);
    };
    const metadata = () => { setDuration(Number.isFinite(audio.duration) ? audio.duration : 0); setLoading(false); };
    const ended = () => next("complete");
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
      setError("This track could not be played. Try another search result.");
      pause();
    };
    audio.addEventListener("timeupdate", time);
    audio.addEventListener("progress", time);
    audio.addEventListener("loadedmetadata", metadata);
    audio.addEventListener("ended", ended);
    audio.addEventListener("waiting", waiting);
    audio.addEventListener("playing", playing);
    audio.addEventListener("error", failed);
    return () => {
      audio.removeEventListener("timeupdate", time);
      audio.removeEventListener("progress", time);
      audio.removeEventListener("loadedmetadata", metadata);
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
    if (equalizer.enabled && isPlaying) void audioContextRef.current?.resume().catch(() => undefined);
  }, [equalizer, isPlaying]);

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
      setError(undefined);
      audio.src = current.streamUrl;
      audio.load();
      setCurrentTime(0);
      setDuration(current.duration ?? 0);
      setLoading(true);
    }
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist, album: current.album, artwork: current.artwork ? [{ src: new URL(current.artwork, window.location.href).href }] : undefined });
    }
    return () => { if (resetFrame !== undefined) window.cancelAnimationFrame(resetFrame); };
  }, [current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (!current.streamUrl) {
      audio.pause();
      return;
    }
    if (isPlaying) audio.play().catch(() => { setError("Press play to start audio in this browser."); pause(); });
    else audio.pause();
  }, [current, isPlaying, pause]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => usePlayerStore.getState().resume());
    navigator.mediaSession.setActionHandler("pause", () => usePlayerStore.getState().pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().next());
    navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().previous());
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset ?? 10));
    });
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || Infinity, audioRef.current.currentTime + (details.seekOffset ?? 10));
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (audioRef.current && details.seekTime !== undefined) audioRef.current.currentTime = details.seekTime;
    });
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select, [contenteditable=true]")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (usePlayerStore.getState().isPlaying) usePlayerStore.getState().pause();
        else usePlayerStore.getState().resume();
      }
      const active = selectCurrentTrack(usePlayerStore.getState());
      if (active && event.code === "ArrowRight" && event.altKey && audioRef.current) audioRef.current.currentTime += 10;
      if (active && event.code === "ArrowLeft" && event.altKey && audioRef.current) audioRef.current.currentTime -= 10;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || seconds));
  }, []);
  const value = useMemo(() => ({ currentTime, duration, buffered, loading, error, seek }), [buffered, currentTime, duration, error, loading, seek]);
  return <PlayerEngineContext.Provider value={value}>{children}</PlayerEngineContext.Provider>;
}
