import type { Track } from "@/lib/types";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_RESULTS = 20;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function firstRunText(value: unknown) {
  const runs = record(value)?.runs;
  if (!Array.isArray(runs)) return;
  for (const run of runs) {
    const text = record(run)?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
}

function simpleText(value: unknown) {
  const node = record(value);
  return typeof node?.simpleText === "string" ? node.simpleText.trim() : firstRunText(node);
}

function durationSeconds(value: unknown) {
  const duration = simpleText(value);
  if (!duration || !/^\d{1,3}(?::\d{2}){1,2}$/.test(duration)) return;
  const parts = duration.split(":").map(Number);
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 && seconds <= 24 * 60 * 60 ? seconds : undefined;
}

function isLiveVideo(renderer: JsonRecord) {
  return JSON.stringify([renderer.badges, renderer.thumbnailOverlays]).toLocaleLowerCase().includes("live");
}

function extractInitialData(html: string) {
  const markers = ["var ytInitialData = ", "window[\"ytInitialData\"] = ", "ytInitialData = "];
  const marker = markers.map((value) => ({ value, index: html.indexOf(value) })).find((item) => item.index >= 0);
  if (!marker) throw new Error("YouTube search data was not found");
  const start = html.indexOf("{", marker.index + marker.value.length);
  if (start < 0) throw new Error("YouTube search data was malformed");

  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return JSON.parse(html.slice(start, index + 1)) as unknown;
  }
  throw new Error("YouTube search data was incomplete");
}

function collectVideoRenderers(value: unknown, output: JsonRecord[]) {
  if (output.length >= MAX_RESULTS * 3) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoRenderers(item, output));
    return;
  }
  const node = record(value);
  if (!node) return;
  const renderer = record(node.videoRenderer);
  if (renderer) output.push(renderer);
  Object.values(node).forEach((item) => collectVideoRenderers(item, output));
}

export function normalizeYouTubeSearchHtml(html: string): Track[] {
  const renderers: JsonRecord[] = [];
  collectVideoRenderers(extractInitialData(html), renderers);
  const seen = new Set<string>();
  const tracks: Track[] = [];

  for (const renderer of renderers) {
    const videoId = renderer.videoId;
    const title = firstRunText(renderer.title);
    const artist = firstRunText(renderer.ownerText) || firstRunText(renderer.longBylineText);
    const duration = durationSeconds(renderer.lengthText);
    if (typeof videoId !== "string" || !VIDEO_ID.test(videoId) || seen.has(videoId) || !title || isLiveVideo(renderer)) continue;
    seen.add(videoId);
    tracks.push({
      id: `youtube:${videoId}`,
      providerTrackId: videoId,
      source: "youtube",
      title: title.slice(0, 200),
      artist: (artist || "YouTube creator").slice(0, 120),
      album: "YouTube",
      artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration,
      genres: [],
      playable: true,
      streamUrl: `/api/youtube/audio?${new URLSearchParams({ videoId })}`,
      youtubeVideoId: videoId,
      originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
    if (tracks.length === MAX_RESULTS) break;
  }
  return tracks;
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " " };

/** The Data API returns HTML-escaped snippets ("&amp;", "&#39;"); decode them for display. */
export function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function normalizeYouTubeDataApiItems(value: unknown): Track[] {
  const items = record(value)?.items;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const node = record(item);
    const videoId = record(node?.id)?.videoId;
    const snippet = record(node?.snippet);
    const title = typeof snippet?.title === "string" ? decodeHtmlEntities(snippet.title).trim() : "";
    const artist = typeof snippet?.channelTitle === "string" ? decodeHtmlEntities(snippet.channelTitle).trim() : "YouTube creator";
    if (typeof videoId !== "string" || !VIDEO_ID.test(videoId) || seen.has(videoId) || !title) return [];
    seen.add(videoId);
    const thumbnails = record(snippet?.thumbnails);
    const thumbnail = ["high", "medium", "default"].map((key) => record(thumbnails?.[key])?.url).find((url): url is string => typeof url === "string");
    return [{
      id: `youtube:${videoId}`,
      providerTrackId: videoId,
      source: "youtube" as const,
      title: title.slice(0, 200),
      artist: artist.slice(0, 120),
      album: "YouTube",
      artwork: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      genres: [],
      playable: true,
      streamUrl: `/api/youtube/audio?${new URLSearchParams({ videoId })}`,
      youtubeVideoId: videoId,
      originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }];
  });
}
