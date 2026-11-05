import type { Playlist, Track, YouTubeLibrary } from "@/lib/types";

type Thumbnail = { url?: string };
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export type YouTubePlaylistSource = {
  id: string;
  title: string;
  description?: string;
  publishedAt?: string;
  items: Array<{
    videoId?: string;
    title?: string;
    artist?: string;
    thumbnails?: Record<string, Thumbnail>;
  }>;
};

function artwork(thumbnails?: Record<string, Thumbnail>) {
  return thumbnails?.maxres?.url || thumbnails?.standard?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url;
}

export function normalizeYouTubeLibrary(sources: YouTubePlaylistSource[]): YouTubeLibrary {
  const tracks = new Map<string, Track>();
  const playlists: Playlist[] = [];

  for (const source of sources) {
    const trackIds: string[] = [];
    for (const item of source.items) {
      if (!item.videoId || !VIDEO_ID.test(item.videoId) || !item.title || item.title === "Deleted video" || item.title === "Private video") continue;
      const id = `youtube:${item.videoId}`;
      const existing = tracks.get(id);
      if (existing) {
        existing.genres = [...new Set([...existing.genres, source.title])];
      } else {
        tracks.set(id, {
          id,
          providerTrackId: item.videoId,
          source: "youtube",
          title: item.title.slice(0, 200),
          artist: (item.artist || "YouTube").slice(0, 120),
          album: source.title.slice(0, 120),
          artwork: artwork(item.thumbnails),
          genres: [source.title.slice(0, 48)],
          playable: true,
          streamUrl: `/api/youtube/audio?${new URLSearchParams({ videoId: item.videoId })}`,
          youtubeVideoId: item.videoId,
          originalUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
        });
      }
      if (!trackIds.includes(id)) trackIds.push(id);
    }

    playlists.push({
      id: `youtube-playlist:${source.id}`,
      name: source.title.slice(0, 80),
      description: (source.description || "Synced from YouTube").slice(0, 240),
      trackIds,
      createdAt: source.publishedAt || new Date().toISOString(),
      source: "youtube",
    });
  }

  return { tracks: [...tracks.values()], playlists };
}
