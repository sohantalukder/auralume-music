import { beforeEach, describe, expect, it } from "vitest";
import type { Track } from "@/lib/types";
import { migratePersistedLibrary, usePlayerStore } from "@/stores/player-store";

const localTracks: Track[] = Array.from({ length: 4 }, (_, index) => ({
  id: `local:${index}`,
  providerTrackId: String(index),
  source: "local",
  title: `Local ${index}`,
  artist: "Local file",
  genres: ["Local"],
  playable: true,
  streamUrl: `blob:${index}`,
}));

const archiveTrack: Track = {
  id: "archive:example:song.mp3",
  providerTrackId: "example/song.mp3",
  source: "archive",
  title: "Archive song",
  artist: "Archive artist",
  genres: ["Open music"],
  playable: true,
  streamUrl: "https://archive.org/download/example/song.mp3",
};

const youtubeTrack: Track = {
  id: "youtube:IF9GJstin2g",
  providerTrackId: "IF9GJstin2g",
  source: "youtube",
  title: "Ami Shunechi Sedin Tumi",
  artist: "Music Channel",
  genres: ["YouTube"],
  playable: true,
  youtubeVideoId: "IF9GJstin2g",
};

describe("player store", () => {
  beforeEach(() => {
    localStorage.clear();
    usePlayerStore.setState({ queue: [], currentIndex: -1, isPlaying: false, likedIds: [], history: [], playlists: [], shuffle: false, repeat: "off", preferences: { artists: [], genres: [], languages: [] } });
  });

  it("plays a track and builds the playable queue", () => {
    usePlayerStore.getState().play(localTracks[1], localTracks);
    expect(usePlayerStore.getState().currentIndex).toBe(1);
    expect(usePlayerStore.getState().queue).toHaveLength(4);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("cycles repeat modes", () => {
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("all");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("one");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("off");
  });

  it("keeps the current track stable when queue items are removed or reordered", () => {
    usePlayerStore.getState().play(localTracks[2], localTracks);
    usePlayerStore.getState().removeFromQueue(0);
    expect(usePlayerStore.getState().queue[usePlayerStore.getState().currentIndex].id).toBe(localTracks[2].id);
    usePlayerStore.getState().moveQueueItem(1, 0);
    expect(usePlayerStore.getState().queue[usePlayerStore.getState().currentIndex].id).toBe(localTracks[2].id);
    usePlayerStore.getState().removeFromQueue(usePlayerStore.getState().currentIndex);
    expect(usePlayerStore.getState().currentIndex).toBeGreaterThanOrEqual(0);
  });

  it("stores playlist track snapshots and supports rename, ordering, removal, and deletion", () => {
    usePlayerStore.getState().createPlaylist("Road trip");
    const playlistId = usePlayerStore.getState().playlists[0].id;
    usePlayerStore.getState().addToPlaylist(playlistId, archiveTrack);
    usePlayerStore.getState().addToPlaylist(playlistId, youtubeTrack);
    usePlayerStore.getState().movePlaylistTrack(playlistId, 1, 0);
    usePlayerStore.getState().renamePlaylist(playlistId, "Weekend");
    expect(usePlayerStore.getState().playlists[0]).toMatchObject({ name: "Weekend", trackIds: [youtubeTrack.id, archiveTrack.id] });
    expect(usePlayerStore.getState().playlists[0].tracks).toEqual([archiveTrack, youtubeTrack]);
    usePlayerStore.getState().removeFromPlaylist(playlistId, archiveTrack.id);
    expect(usePlayerStore.getState().playlists[0].trackIds).toEqual([youtubeTrack.id]);
    usePlayerStore.getState().deletePlaylist(playlistId);
    expect(usePlayerStore.getState().playlists).toEqual([]);
  });

  it("toggles likes without duplicates", () => {
    usePlayerStore.getState().toggleLike(localTracks[0].id);
    usePlayerStore.getState().toggleLike(localTracks[0].id);
    expect(usePlayerStore.getState().likedIds).toEqual([]);
  });

  it("keeps current sources and removes legacy records from persisted browser data", () => {
    const migrated = migratePersistedLibrary({
      volume: 0.6,
      likedIds: ["remote:old", localTracks[0].id, archiveTrack.id, youtubeTrack.id],
      history: [{ id: "remote:old" }, localTracks[0], archiveTrack, youtubeTrack],
      playlists: [{ id: "one", name: "Saved", description: "", createdAt: "2026-01-01", trackIds: ["remote:old", localTracks[0].id, archiveTrack.id, youtubeTrack.id] }],
    });

    expect(migrated.volume).toBe(0.6);
    expect(migrated.likedIds).toEqual([localTracks[0].id, archiveTrack.id, youtubeTrack.id]);
    expect(migrated.history).toEqual([archiveTrack, youtubeTrack]);
    expect(migrated.playlists?.[0].trackIds).toEqual([localTracks[0].id, archiveTrack.id, youtubeTrack.id]);
    expect(migrated.playlists?.[0].tracks).toEqual([{ ...localTracks[0], playable: false, streamUrl: undefined }, archiveTrack, youtubeTrack]);
    expect(migrated.preferences).toEqual({ artists: [], genres: [], languages: [] });
    expect(migrated.equalizer).toMatchObject({ enabled: false, preset: "flat" });
  });
});
