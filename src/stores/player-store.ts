import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppearanceSettings, EqualizerSettings, ListeningPreferences, Playlist, Track } from "@/lib/types";
import { clearPersonalization, recordRecommendationSignal } from "@/lib/personalization";
import { defaultAppearance, defaultEqualizer, equalizerPresets, normalizeEqualizer } from "@/lib/customization";

type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  likedIds: string[];
  history: Track[];
  localTracks: Track[];
  syncedTracks: Track[];
  playlists: Playlist[];
  preferences: ListeningPreferences;
  equalizer: EqualizerSettings;
  appearance: AppearanceSettings;
  play: (track: Track, context?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  next: (reason?: "skip" | "complete") => void;
  previous: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: (id: string) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (from: number, to: number) => void;
  setLocalTracks: (tracks: Track[]) => void;
  addLocalTrack: (track: Track) => void;
  removeLocalTrack: (id: string) => void;
  syncYouTubeLibrary: (tracks: Track[], playlists: Playlist[]) => void;
  createPlaylist: (name: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  movePlaylistTrack: (playlistId: string, from: number, to: number) => void;
  setPreferences: (preferences: ListeningPreferences) => void;
  setEqualizerEnabled: (enabled: boolean) => void;
  setEqualizerPreset: (preset: EqualizerSettings["preset"]) => void;
  setEqualizerGain: (index: number, gain: number) => void;
  setAppearance: (appearance: AppearanceSettings) => void;
  resetAppearance: () => void;
  clearPersonalData: () => Promise<void>;
};

type PersistedLibrary = Pick<PlayerState, "volume" | "muted" | "shuffle" | "repeat" | "likedIds" | "history" | "syncedTracks" | "playlists" | "preferences" | "equalizer" | "appearance">;

const emptyPreferences: ListeningPreferences = { artists: [], genres: [], languages: [] };

function cleanList(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 20) : [];
}

function snapshotTrack(track: Track): Track {
  return track.source === "local" ? { ...track, playable: false, streamUrl: undefined } : track;
}

export function migratePersistedLibrary(value: unknown): Partial<PersistedLibrary> {
  if (!value || typeof value !== "object") return {};
  const state = value as Partial<PersistedLibrary>;
  const isCurrentId = (id: unknown) => typeof id === "string" && (id.startsWith("local:") || id.startsWith("archive:") || id.startsWith("youtube:"));
  const knownTracks = [...(Array.isArray(state.history) ? state.history : []), ...(Array.isArray(state.syncedTracks) ? state.syncedTracks : [])]
    .filter((track): track is Track => Boolean(track && isCurrentId(track.id)));
  return {
    ...state,
    likedIds: Array.isArray(state.likedIds) ? state.likedIds.filter((id): id is string => isCurrentId(id)) : [],
    // Blob URLs are recreated from IndexedDB after reload, so only remote tracks
    // are safe to restore directly from persisted history.
    history: Array.isArray(state.history) ? state.history.filter((track) => (track?.source === "archive" || track?.source === "youtube") && isCurrentId(track.id)) : [],
    syncedTracks: Array.isArray(state.syncedTracks) ? state.syncedTracks.filter((track) => track?.source === "youtube" && isCurrentId(track.id)) : [],
    playlists: Array.isArray(state.playlists)
      ? state.playlists.filter((playlist) => playlist && typeof playlist.id === "string").map((playlist) => ({
          ...playlist,
          trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds.filter(isCurrentId) : [],
          tracks: (Array.isArray(playlist.tracks) ? playlist.tracks : knownTracks.filter((track) => playlist.trackIds?.includes(track.id))).map(snapshotTrack),
        }))
      : [],
    preferences: {
      artists: cleanList(state.preferences?.artists),
      genres: cleanList(state.preferences?.genres),
      languages: cleanList(state.preferences?.languages),
    },
    equalizer: normalizeEqualizer(state.equalizer),
    appearance: state.appearance && typeof state.appearance === "object" ? { ...defaultAppearance, ...state.appearance } : defaultAppearance,
  };
}

function shuffledNext(length: number, current: number) {
  if (length < 2) return current;
  let next = current;
  while (next === current) next = Math.floor(Math.random() * length);
  return next;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      volume: 0.75,
      muted: false,
      shuffle: false,
      repeat: "off",
      likedIds: [],
      history: [],
      localTracks: [],
      syncedTracks: [],
      playlists: [],
      preferences: emptyPreferences,
      equalizer: defaultEqualizer,
      appearance: defaultAppearance,
      play: (track, context) => {
        void recordRecommendationSignal("play", track).catch(() => undefined);
        set((state) => {
          const queue = context?.length ? context.filter((item) => item.playable) : state.queue;
          const nextQueue = queue.some((item) => item.id === track.id) ? queue : [...queue, track];
          const index = nextQueue.findIndex((item) => item.id === track.id);
          return {
            queue: nextQueue,
            currentIndex: index,
            isPlaying: track.playable,
            history: [track, ...state.history.filter((item) => item.id !== track.id)].slice(0, 30),
          };
        });
      },
      pause: () => set({ isPlaying: false }),
      resume: () => set({ isPlaying: true }),
      next: (reason = "skip") =>
        set((state) => {
          if (!state.queue.length) return state;
          const current = state.queue[state.currentIndex];
          if (current) void recordRecommendationSignal(reason, current).catch(() => undefined);
          if (state.repeat === "one") return { ...state, isPlaying: true };
          const index = state.shuffle
            ? shuffledNext(state.queue.length, state.currentIndex)
            : state.currentIndex + 1 < state.queue.length
              ? state.currentIndex + 1
              : state.repeat === "all"
                ? 0
                : state.currentIndex;
          return { currentIndex: index, isPlaying: index !== state.currentIndex || state.repeat === "all" };
        }),
      previous: () => set((state) => ({ currentIndex: Math.max(0, state.currentIndex - 1), isPlaying: true })),
      setVolume: (volume) => set({ volume, muted: volume === 0 }),
      toggleMute: () => set((state) => ({ muted: !state.muted })),
      toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
      cycleRepeat: () => set((state) => ({ repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off" })),
      toggleLike: (id) => set((state) => {
        const liked = state.likedIds.includes(id);
        const track = [...state.queue, ...state.history, ...state.localTracks].find((item) => item.id === id);
        if (track) void recordRecommendationSignal(liked ? "unlike" : "like", track).catch(() => undefined);
        return { likedIds: liked ? state.likedIds.filter((item) => item !== id) : [...state.likedIds, id] };
      }),
      addToQueue: (track) => set((state) => ({ queue: [...state.queue, track] })),
      removeFromQueue: (index) => set((state) => {
        if (index < 0 || index >= state.queue.length) return state;
        const queue = state.queue.filter((_, itemIndex) => itemIndex !== index);
        if (!queue.length) return { queue, currentIndex: -1, isPlaying: false };
        if (index < state.currentIndex) return { queue, currentIndex: state.currentIndex - 1 };
        if (index === state.currentIndex) return { queue, currentIndex: Math.min(index, queue.length - 1), isPlaying: state.isPlaying };
        return { queue };
      }),
      moveQueueItem: (from, to) => set((state) => {
        if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return state;
        const queue = [...state.queue];
        const [track] = queue.splice(from, 1);
        queue.splice(to, 0, track);
        let currentIndex = state.currentIndex;
        if (currentIndex === from) currentIndex = to;
        else if (from < currentIndex && to >= currentIndex) currentIndex -= 1;
        else if (from > currentIndex && to <= currentIndex) currentIndex += 1;
        return { queue, currentIndex };
      }),
      setLocalTracks: (localTracks) => set({ localTracks }),
      addLocalTrack: (track) => set((state) => ({ localTracks: [...state.localTracks, track] })),
      removeLocalTrack: (id) => set((state) => ({ localTracks: state.localTracks.filter((track) => track.id !== id), queue: state.queue.filter((track) => track.id !== id) })),
      syncYouTubeLibrary: (tracks, playlists) => set((state) => ({
        syncedTracks: tracks,
        playlists: [...state.playlists.filter((playlist) => playlist.source !== "youtube"), ...playlists],
      })),
      createPlaylist: (name) => set((state) => ({ playlists: [...state.playlists, { id: crypto.randomUUID(), name, description: "Created in Auralume", trackIds: [], createdAt: new Date().toISOString(), source: "local" }] })),
      renamePlaylist: (playlistId, name) => set((state) => ({ playlists: state.playlists.map((playlist) => playlist.id === playlistId && playlist.source !== "youtube" ? { ...playlist, name: name.trim().slice(0, 60) || playlist.name } : playlist) })),
      deletePlaylist: (playlistId) => set((state) => ({ playlists: state.playlists.filter((playlist) => playlist.id !== playlistId || playlist.source === "youtube") })),
      addToPlaylist: (playlistId, track) => set((state) => ({ playlists: state.playlists.map((playlist) => playlist.id === playlistId && playlist.source !== "youtube" && !playlist.trackIds.includes(track.id) ? { ...playlist, trackIds: [...playlist.trackIds, track.id], tracks: [...(playlist.tracks ?? []), snapshotTrack(track)] } : playlist) })),
      removeFromPlaylist: (playlistId, trackId) => set((state) => ({ playlists: state.playlists.map((playlist) => playlist.id === playlistId && playlist.source !== "youtube" ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId), tracks: playlist.tracks?.filter((track) => track.id !== trackId) } : playlist) })),
      movePlaylistTrack: (playlistId, from, to) => set((state) => ({ playlists: state.playlists.map((playlist) => {
        if (playlist.id !== playlistId || playlist.source === "youtube" || from === to || from < 0 || to < 0 || from >= playlist.trackIds.length || to >= playlist.trackIds.length) return playlist;
        const trackIds = [...playlist.trackIds];
        const [id] = trackIds.splice(from, 1);
        trackIds.splice(to, 0, id);
        return { ...playlist, trackIds };
      }) })),
      setPreferences: (preferences) => set({ preferences: { artists: cleanList(preferences.artists), genres: cleanList(preferences.genres), languages: cleanList(preferences.languages) } }),
      setEqualizerEnabled: (enabled) => set((state) => ({ equalizer: { ...state.equalizer, enabled } })),
      setEqualizerPreset: (preset) => set({ equalizer: { enabled: true, preset, gains: [...equalizerPresets[preset]] } }),
      setEqualizerGain: (index, gain) => set((state) => ({ equalizer: { enabled: true, preset: "custom", gains: state.equalizer.gains.map((value, itemIndex) => itemIndex === index ? Math.max(-12, Math.min(12, gain)) : value) } })),
      setAppearance: (appearance) => set({ appearance }),
      resetAppearance: () => set({ appearance: defaultAppearance }),
      clearPersonalData: async () => {
        await clearPersonalization();
        set({ queue: [], currentIndex: -1, isPlaying: false, likedIds: [], history: [], localTracks: [], syncedTracks: [], playlists: [], preferences: emptyPreferences, equalizer: defaultEqualizer, appearance: defaultAppearance });
      },
    }),
    {
      name: "aura-library-v1",
      version: 7,
      migrate: (persistedState) => migratePersistedLibrary(persistedState),
      partialize: (state) => ({ volume: state.volume, muted: state.muted, shuffle: state.shuffle, repeat: state.repeat, likedIds: state.likedIds, history: state.history.filter((track) => track.source !== "local"), syncedTracks: state.syncedTracks, playlists: state.playlists, preferences: state.preferences, equalizer: state.equalizer, appearance: state.appearance }),
    },
  ),
);

export const selectCurrentTrack = (state: PlayerState) => state.queue[state.currentIndex];
