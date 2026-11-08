import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppearanceSettings, EqualizerSettings, ListeningPreferences, Playlist, Track } from "@/lib/types";
import { clearPersonalization, recordRecommendationSignal } from "@/lib/personalization";
import { defaultAppearance, defaultEqualizer, equalizerPresets, normalizeEqualizer } from "@/lib/customization";
import { createId } from "@/lib/utils";

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
  likedTracks: Track[];
  history: Track[];
  localTracks: Track[];
  localTracksLoaded: boolean;
  syncedTracks: Track[];
  playlists: Playlist[];
  preferences: ListeningPreferences;
  equalizer: EqualizerSettings;
  appearance: AppearanceSettings;
  play: (track: Track, context?: Track[]) => void;
  cue: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  next: (reason?: "skip" | "complete") => void;
  previous: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: (track: Track) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (from: number, to: number) => void;
  setLocalTracks: (tracks: Track[]) => void;
  addLocalTrack: (track: Track) => void;
  removeLocalTrack: (id: string) => void;
  createPlaylist: (name: string) => string;
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

type PersistedLibrary = Pick<PlayerState, "queue" | "currentIndex" | "volume" | "muted" | "shuffle" | "repeat" | "likedIds" | "likedTracks" | "history" | "syncedTracks" | "playlists" | "preferences" | "equalizer" | "appearance">;

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
  const persistedQueue = Array.isArray(state.queue) ? state.queue : [];
  const queue = persistedQueue.filter((track): track is Track => Boolean(track && (track.source === "archive" || track.source === "youtube") && isCurrentId(track.id)));
  const persistedCurrentId = Number.isInteger(state.currentIndex) ? persistedQueue[state.currentIndex as number]?.id : undefined;
  const restoredIndex = persistedCurrentId ? queue.findIndex((track) => track.id === persistedCurrentId) : -1;
  const currentIndex = restoredIndex >= 0 ? restoredIndex : queue.length ? 0 : -1;
  const knownTracks = [...queue, ...(Array.isArray(state.history) ? state.history : []), ...(Array.isArray(state.syncedTracks) ? state.syncedTracks : [])]
    .filter((track): track is Track => Boolean(track && isCurrentId(track.id)));
  const knownTrackById = new Map(knownTracks.map((track) => [track.id, track]));
  const likedIds = Array.isArray(state.likedIds) ? state.likedIds.filter((id): id is string => isCurrentId(id)) : [];
  return {
    ...state,
    queue,
    currentIndex,
    likedIds,
    // Liked tracks are snapshotted so they stay listed even after leaving history.
    likedTracks: (Array.isArray(state.likedTracks) ? state.likedTracks : likedIds.map((id) => knownTrackById.get(id)))
      .filter((track): track is Track => Boolean(track && likedIds.includes(track.id)))
      .map(snapshotTrack),
    // Blob URLs are recreated from IndexedDB after reload, so only remote tracks
    // are safe to restore directly from persisted history.
    history: Array.isArray(state.history) ? state.history.filter((track) => (track?.source === "archive" || track?.source === "youtube") && isCurrentId(track.id)) : [],
    syncedTracks: Array.isArray(state.syncedTracks) ? state.syncedTracks.filter((track) => track?.source === "youtube" && isCurrentId(track.id)) : [],
    playlists: Array.isArray(state.playlists)
      ? state.playlists.filter((playlist) => playlist && typeof playlist.id === "string").map((playlist) => ({
          ...playlist,
          trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds.filter(isCurrentId) : [],
          tracks: (Array.isArray(playlist.tracks) ? playlist.tracks : playlist.trackIds?.map((id) => knownTrackById.get(id)).filter((track): track is Track => Boolean(track)) ?? []).map(snapshotTrack),
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
      likedTracks: [],
      history: [],
      localTracks: [],
      localTracksLoaded: false,
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
      // Loads a track without starting it (used to restore the player from its URL);
      // browsers block autoplay after a reload, so playback waits for the user.
      cue: (track) => set((state) => {
        const index = state.queue.findIndex((item) => item.id === track.id);
        return index >= 0 ? { currentIndex: index, isPlaying: false } : { queue: [...state.queue, track], currentIndex: state.queue.length, isPlaying: false };
      }),
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
      toggleLike: (track) => set((state) => {
        const liked = state.likedIds.includes(track.id);
        void recordRecommendationSignal(liked ? "unlike" : "like", track).catch(() => undefined);
        return liked
          ? { likedIds: state.likedIds.filter((item) => item !== track.id), likedTracks: state.likedTracks.filter((item) => item.id !== track.id) }
          : { likedIds: [...state.likedIds, track.id], likedTracks: [...state.likedTracks, snapshotTrack(track)] };
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
      setLocalTracks: (localTracks) => set({ localTracks, localTracksLoaded: true }),
      addLocalTrack: (track) => set((state) => ({ localTracks: [...state.localTracks, track] })),
      removeLocalTrack: (id) => set((state) => ({ localTracks: state.localTracks.filter((track) => track.id !== id), queue: state.queue.filter((track) => track.id !== id) })),
      createPlaylist: (name) => {
        const id = createId();
        set((state) => ({ playlists: [...state.playlists, { id, name: name.trim().slice(0, 60), description: "Playlist", trackIds: [], tracks: [], createdAt: new Date().toISOString(), source: "local" }] }));
        return id;
      },
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
        set({ queue: [], currentIndex: -1, isPlaying: false, likedIds: [], likedTracks: [], history: [], localTracks: [], syncedTracks: [], playlists: [], preferences: emptyPreferences, equalizer: defaultEqualizer, appearance: defaultAppearance });
      },
    }),
    {
      name: "aura-library-v1",
      version: 9,
      // Rehydrated by Providers after mount, so the first client render matches the
      // server HTML; hydrating during render left controlled inputs out of sync.
      skipHydration: true,
      migrate: (persistedState) => migratePersistedLibrary(persistedState),
      partialize: (state) => {
        const queue = state.queue.filter((track) => track.source !== "local");
        const currentId = state.queue[state.currentIndex]?.id;
        const currentIndex = currentId ? queue.findIndex((track) => track.id === currentId) : -1;
        return { queue, currentIndex, volume: state.volume, muted: state.muted, shuffle: state.shuffle, repeat: state.repeat, likedIds: state.likedIds, likedTracks: state.likedTracks, history: state.history.filter((track) => track.source !== "local"), syncedTracks: state.syncedTracks, playlists: state.playlists, preferences: state.preferences, equalizer: state.equalizer, appearance: state.appearance };
      },
    },
  ),
);

export const selectCurrentTrack = (state: PlayerState) => state.queue[state.currentIndex];

/** Link to the full player that survives a reload by naming the track. */
export const playerHref = (track: Pick<Track, "id">) => `/player?track=${encodeURIComponent(track.id)}`;

/** Finds a track this browser already knows by id, for restoring the player from its URL. */
export function findKnownTrack(state: PlayerState, id: string): Track | undefined {
  const sources = [state.queue, state.localTracks, state.history, state.likedTracks, state.syncedTracks, ...state.playlists.map((playlist) => playlist.tracks ?? [])];
  for (const tracks of sources) {
    const track = tracks.find((item) => item.id === id);
    // Snapshots of local files lose their blob URL; only the live IndexedDB copy is playable.
    if (track && (track.source !== "local" || track.streamUrl)) return track;
  }
  return undefined;
}

/** True once the saved library has been loaded from browser storage (always false during SSR). */
export function useStoreHydrated() {
  return useSyncExternalStore(
    (onChange) => usePlayerStore.persist.onFinishHydration(onChange),
    () => usePlayerStore.persist.hasHydrated(),
    () => false,
  );
}
