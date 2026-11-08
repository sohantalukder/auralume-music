"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { selectCurrentTrack, usePlayerStore } from "@/stores/player-store";
import { equalizerFrequencies } from "@/lib/customization";
import type { Track } from "@/lib/types";

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

type YouTubePlayer = {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoLoadedFraction(): number;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    playerVars: Record<string, string | number>;
    events: {
      onReady: () => void;
      onStateChange: (event: { data: number }) => void;
      onError: () => void;
    };
  }) => YouTubePlayer;
};

type YouTubeWindow = Window & { YT?: YouTubeNamespace; onYouTubeIframeAPIReady?: () => void };

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_BUFFERING = 3;

let youTubeApi: Promise<YouTubeNamespace> | undefined;

// YouTube only serves its streams to the listener's own browser (servers are bot-checked),
// so YouTube tracks play through the official IFrame player instead of the audio element.
function loadYouTubeApi() {
  const host = window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  youTubeApi ??= new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = host.onYouTubeIframeAPIReady;
    host.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (host.YT?.Player) resolve(host.YT);
      else reject(new Error("YouTube player did not initialize"));
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      youTubeApi = undefined;
      script.remove();
      reject(new Error("YouTube player could not be loaded"));
    };
    document.head.append(script);
  });
  return youTubeApi;
}

function isYouTube(track: Track | undefined): track is Track & { youtubeVideoId: string } {
  return track?.source === "youtube" && Boolean(track.youtubeVideoId);
}

// The audio element plays every source except YouTube.
function nativeStreamUrl(track: Track | undefined) {
  return track && !isYouTube(track) ? track.streamUrl : undefined;
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
  const youTubeHostRef = useRef<HTMLDivElement | null>(null);
  const youTubeRef = useRef<{ player: YouTubePlayer; ready: boolean; videoId?: string } | null>(null);
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

  // Advances after a track ends; true when the same track should restart
  // (repeat-one, or repeat-all on a one-track queue), since nothing reloads it.
  const finishTrack = useCallback(() => {
    const before = selectCurrentTrack(usePlayerStore.getState())?.id;
    next("complete");
    const state = usePlayerStore.getState();
    return state.isPlaying && selectCurrentTrack(state)?.id === before;
  }, [next]);

  const skipFailedTrack = useCallback(() => {
    const { queue, currentIndex, repeat, shuffle } = usePlayerStore.getState();
    setLoading(false);
    setError(`"${selectCurrentTrack(usePlayerStore.getState())?.title ?? "This track"}" could not be played, so it was skipped.`);
    // Skip instead of stopping so one broken stream doesn't end a locked-screen session.
    if (queue.length > 1 && (shuffle || repeat === "all" || currentIndex + 1 < queue.length)) next("skip");
    else pause();
  }, [next, pause]);

  useEffect(() => {
    // One element for every non-YouTube source: mobile browsers only keep playing (and allow
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
      if (finishTrack()) {
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
      skipFailedTrack();
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
  }, [finishTrack, next, pause, skipFailedTrack]);

  const youTubeVideoId = isYouTube(current) ? current.youtubeVideoId : undefined;
  const trackDuration = current?.duration;

  useEffect(() => {
    const host = youTubeHostRef.current;
    if (!youTubeVideoId || !host) {
      const youTube = youTubeRef.current;
      if (youTube?.ready && youTube.videoId) {
        youTube.player.stopVideo();
        youTube.videoId = undefined;
      }
      return;
    }
    const videoId = youTubeVideoId;
    let cancelled = false;
    const reset = window.requestAnimationFrame(() => {
      setCurrentTime(0);
      setBuffered(0);
      setDuration(trackDuration ?? 0);
      setError(undefined);
      setLoading(usePlayerStore.getState().isPlaying);
    });
    const existing = youTubeRef.current;
    if (existing) {
      if (existing.ready && existing.videoId !== videoId) {
        existing.videoId = videoId;
        if (usePlayerStore.getState().isPlaying) existing.player.loadVideoById(videoId);
        else existing.player.cueVideoById(videoId);
      }
    } else {
      loadYouTubeApi().then((api) => {
        if (cancelled || youTubeRef.current) return;
        const mount = document.createElement("div");
        host.replaceChildren(mount);
        const youTube: { player: YouTubePlayer; ready: boolean; videoId?: string } = {
          ready: false,
          videoId,
          player: new api.Player(mount, {
            videoId,
            playerVars: { autoplay: usePlayerStore.getState().isPlaying ? 1 : 0, controls: 0, playsinline: 1, rel: 0, origin: window.location.origin },
            events: {
              onReady: () => {
                youTube.ready = true;
                const state = usePlayerStore.getState();
                youTube.player.setVolume(state.volume * 100);
                if (state.muted) youTube.player.mute();
                else youTube.player.unMute();
                // The track may have changed while the player was starting.
                const active = selectCurrentTrack(state);
                if (!isYouTube(active)) {
                  youTube.player.stopVideo();
                  youTube.videoId = undefined;
                  setLoading(false);
                } else if (active.youtubeVideoId !== youTube.videoId) {
                  youTube.videoId = active.youtubeVideoId;
                  if (state.isPlaying) youTube.player.loadVideoById(active.youtubeVideoId);
                  else youTube.player.cueVideoById(active.youtubeVideoId);
                } else if (state.isPlaying) youTube.player.playVideo();
                else setLoading(false);
              },
              onStateChange: ({ data }) => {
                if (data === YT_PLAYING) {
                  setLoading(false);
                  setError(undefined);
                } else if (data === YT_BUFFERING) setLoading(true);
                else if (data === YT_ENDED && finishTrack()) {
                  youTube.player.seekTo(0, true);
                  youTube.player.playVideo();
                }
              },
              onError: () => skipFailedTrack(),
            },
          }),
        };
        youTubeRef.current = youTube;
      }).catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError("The YouTube player could not be loaded. Check your connection and try again.");
        pause();
      });
    }
    const progress = window.setInterval(() => {
      const youTube = youTubeRef.current;
      if (!youTube?.ready || youTube.videoId !== videoId) return;
      const total = youTube.player.getDuration() || 0;
      setCurrentTime(youTube.player.getCurrentTime() || 0);
      if (total > 0) setDuration(total);
      setBuffered((youTube.player.getVideoLoadedFraction() || 0) * total);
    }, 500);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(reset);
      window.clearInterval(progress);
    };
  }, [youTubeVideoId, trackDuration, finishTrack, pause, skipFailedTrack]);

  useEffect(() => () => {
    youTubeRef.current?.player.destroy();
    youTubeRef.current = null;
  }, []);

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
    const streamUrl = nativeStreamUrl(current);
    if (!streamUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (!isYouTube(current)) resetFrame = window.requestAnimationFrame(() => {
        setCurrentTime(0);
        setDuration(current.duration ?? 0);
        setBuffered(0);
        setLoading(false);
        setError(undefined);
      });
    } else if (audio.src !== new URL(streamUrl, window.location.href).href) {
      retryCountRef.current = 0;
      audio.src = streamUrl;
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
    if (isYouTube(current)) {
      audio.pause();
      const youTube = youTubeRef.current;
      if (youTube?.ready && youTube.videoId === current.youtubeVideoId) {
        if (isPlaying) youTube.player.playVideo();
        else youTube.player.pauseVideo();
      }
      return;
    }
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
    const youTube = youTubeRef.current;
    if (!youTube?.ready) return;
    youTube.player.setVolume(volume * 100);
    if (muted) youTube.player.mute();
    else youTube.player.unMute();
  }, [volume, muted]);

  const seek = useCallback((seconds: number) => {
    if (isYouTube(selectCurrentTrack(usePlayerStore.getState()))) {
      const youTube = youTubeRef.current;
      if (!youTube?.ready) return;
      youTube.player.seekTo(Math.max(0, Math.min(seconds, youTube.player.getDuration() || seconds)), true);
      setCurrentTime(Math.max(0, seconds));
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  }, []);

  const position = useCallback(() => {
    if (isYouTube(selectCurrentTrack(usePlayerStore.getState()))) {
      const youTube = youTubeRef.current;
      return youTube?.ready ? youTube.player.getCurrentTime() || 0 : undefined;
    }
    return audioRef.current?.currentTime;
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => usePlayerStore.getState().resume()],
      ["pause", () => usePlayerStore.getState().pause()],
      ["nexttrack", () => usePlayerStore.getState().next()],
      ["previoustrack", () => usePlayerStore.getState().previous()],
      ["seekbackward", (details) => { const at = position(); if (at !== undefined) seek(at - (details.seekOffset ?? 10)); }],
      ["seekforward", (details) => { const at = position(); if (at !== undefined) seek(at + (details.seekOffset ?? 10)); }],
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
  }, [position, seek]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select, button, [role=slider], [contenteditable=true]")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (usePlayerStore.getState().isPlaying) usePlayerStore.getState().pause();
        else usePlayerStore.getState().resume();
      }
      const at = position();
      if (at === undefined || !event.altKey) return;
      if (event.code === "ArrowRight") seek(at + 10);
      if (event.code === "ArrowLeft") seek(at - 10);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [position, seek]);

  const engine = useMemo(() => ({ duration, loading, error, seek }), [duration, error, loading, seek]);
  const progress = useMemo(() => ({ currentTime, buffered }), [buffered, currentTime]);
  return (
    <PlayerEngineContext.Provider value={engine}>
      <PlayerProgressContext.Provider value={progress}>{children}</PlayerProgressContext.Provider>
      <div className="youtube-player-host" ref={youTubeHostRef} aria-hidden="true" />
    </PlayerEngineContext.Provider>
  );
}
