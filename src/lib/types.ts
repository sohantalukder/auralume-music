export type TrackSource = "local" | "archive" | "youtube";

export type Track = {
  id: string;
  providerTrackId: string;
  source: TrackSource;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration?: number;
  createdAt?: string;
  popularity?: number;
  genres: string[];
  playable: boolean;
  streamUrl?: string;
  youtubeVideoId?: string;
  downloadUrl?: string;
  originalUrl?: string;
  license?: { name: string; url?: string };
};

export type SearchEvent = {
  id: string;
  query: string;
  category?: string;
  resultIds: string[];
  tracks?: Track[];
  createdAt: string;
};

export type CategoryAffinity = {
  category: string;
  score: number;
  updatedAt: string;
};

export type RecommendationSignalKind = "play" | "complete" | "skip" | "like" | "unlike" | "impression";

export type RecommendationSignal = {
  id: string;
  kind: RecommendationSignalKind;
  trackId: string;
  categories: string[];
  createdAt: string;
};

export type PersonalizationProfile = {
  searches: SearchEvent[];
  categories: CategoryAffinity[];
  signals: RecommendationSignal[];
};

export type LyricsResult = {
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
  sourceUrl: string;
};

export type Playlist = {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  tracks?: Track[];
  createdAt: string;
  source?: "local" | "youtube";
};

export type ListeningPreferences = {
  artists: string[];
  genres: string[];
  languages: string[];
};

export type EqualizerSettings = {
  enabled: boolean;
  preset: "flat" | "bass" | "vocal" | "bright" | "custom";
  gains: number[];
};

export type AppearanceSettings = {
  enabled: boolean;
  background: string;
  surface: string;
  foreground: string;
  accent: string;
};

export type YouTubeLibrary = {
  tracks: Track[];
  playlists: Playlist[];
};

