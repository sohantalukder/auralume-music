import "server-only";
import { Innertube, Platform } from "youtubei.js";
import { getYouTubeContentPoToken } from "@/lib/youtube-potoken";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_AUDIO_BYTES = 250 * 1024 * 1024;
const CACHE_FALLBACK_MS = 60 * 60 * 1000;

export type YouTubeAudioTarget = {
  url: string;
  mimeType: string;
  contentLength: number;
  maxRangeBytes: number;
};

type CachedTarget = { target: YouTubeAudioTarget; expiresAt: number };

let clientPromise: Promise<Innertube> | undefined;
const targets = new Map<string, CachedTarget>();
const pending = new Map<string, Promise<YouTubeAudioTarget>>();

// The MWEB fallback deciphers stream URLs with YouTube's player script.
Platform.shim.eval = async (data) => new Function(data.output)();

function client() {
  clientPromise ??= Innertube.create({
    generate_session_locally: false,
    lang: "en",
    retrieve_player: true,
  }).catch((error: unknown) => {
    // Don't keep a failed session for the lifetime of the server instance.
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}

function validateTarget(urlValue: string, mimeType: string, contentLength: number, maxRangeBytes: number): YouTubeAudioTarget {
  const url = new URL(urlValue);
  if (url.protocol !== "https:" || !/(^|\.)googlevideo\.com$/i.test(url.hostname)) throw new Error("Unexpected audio host");
  if (!mimeType.toLocaleLowerCase().startsWith("audio/mp4")) throw new Error("Unsupported audio format");
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_AUDIO_BYTES) throw new Error("Invalid audio size");
  return { url: url.href, mimeType: "audio/mp4", contentLength, maxRangeBytes };
}

function cacheExpiry(urlValue: string) {
  const expiry = Number(new URL(urlValue).searchParams.get("expire")) * 1000;
  const safeExpiry = Number.isFinite(expiry) && expiry > Date.now() ? expiry - 5 * 60 * 1000 : Date.now() + CACHE_FALLBACK_MS;
  return Math.min(safeExpiry, Date.now() + CACHE_FALLBACK_MS);
}

type BasicInfo = Awaited<ReturnType<Innertube["getBasicInfo"]>>;

// chooseFormat only reports "Streaming data not available"; keep YouTube's own
// refusal (for example a bot check on datacenter IPs) so failures are diagnosable.
function audioFormat(info: BasicInfo) {
  const status = info.playability_status;
  if (status && status.status !== "OK") throw new Error(`${status.status}: ${status.reason || "no reason given"}`);
  return info.chooseFormat({ format: "mp4", quality: "best", type: "audio" });
}

async function resolveFresh(videoId: string) {
  const innertube = await client();
  const failures: string[] = [];
  for (const option of [{ client: "VISIONOS" as const, maxRangeBytes: 1024 * 1024 }, { client: "IOS" as const, maxRangeBytes: 16 * 1024 }]) {
    try {
      const format = audioFormat(await innertube.getBasicInfo(videoId, { client: option.client }));
      const url = await format.decipher(innertube.session.player);
      if (!url) throw new Error("No audio stream URL");
      const target = validateTarget(url, format.mime_type, Number(format.content_length), option.maxRangeBytes);
      targets.set(videoId, { target, expiresAt: cacheExpiry(target.url) });
      return target;
    } catch (error) {
      failures.push(`${option.client} ${errorMessage(error)}`);
    }
  }
  try {
    const poToken = await getYouTubeContentPoToken(videoId);
    const format = audioFormat(await innertube.getBasicInfo(videoId, { client: "MWEB", po_token: poToken }));
    const streamUrl = new URL(await format.decipher(innertube.session.player));
    streamUrl.searchParams.set("pot", poToken);
    const target = validateTarget(streamUrl.href, format.mime_type, Number(format.content_length), 16 * 1024);
    targets.set(videoId, { target, expiresAt: cacheExpiry(target.url) });
    return target;
  } catch (error) {
    failures.push(`MWEB ${errorMessage(error)}`);
  }
  throw new Error(failures.join("; "));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function resolveYouTubeAudio(videoId: string, forceRefresh = false) {
  if (!VIDEO_ID.test(videoId)) throw new Error("Invalid YouTube video ID");
  if (forceRefresh) targets.delete(videoId);
  const cached = targets.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.target;
  const existing = pending.get(videoId);
  if (existing) return existing;
  const resolution = resolveFresh(videoId).finally(() => pending.delete(videoId));
  pending.set(videoId, resolution);
  return resolution;
}
