import type { Track } from "@/lib/types";

export type SearchPage = { data: Track[]; nextPage?: number };
export type YouTubeSearchPage = { data: Track[]; nextPageToken?: string };

export function mergeSearchSources(...groups: Track[][]) {
  return groups.flat().filter((track, index, all) => all.findIndex((item) => item.id === track.id) === index);
}

export async function fetchArchiveSearch(query: string, page: number, signal: AbortSignal): Promise<SearchPage> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  const response = await fetch(`/api/archive?${params}`, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Online search is temporarily unavailable.");
  return body;
}

export async function fetchYouTubeSearchPage(query: string, signal: AbortSignal, pageToken?: string): Promise<YouTubeSearchPage> {
  const params = new URLSearchParams({ q: query });
  if (pageToken) params.set("pageToken", pageToken);
  const response = await fetch(`/api/youtube/search?${params}`, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "YouTube search is temporarily unavailable.");
  return { data: body.data ?? [], nextPageToken: body.nextPageToken };
}

export async function fetchYouTubeSearch(query: string, signal: AbortSignal): Promise<Track[]> {
  return (await fetchYouTubeSearchPage(query, signal)).data;
}
