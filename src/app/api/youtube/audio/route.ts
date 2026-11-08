import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveYouTubeAudio, type YouTubeAudioTarget } from "@/lib/youtube-audio";

export const runtime = "nodejs";
export const maxDuration = 60;

const videoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const rangeSchema = /^bytes=(\d+)-(\d*)$/;
// Each browser range request is answered with at most this many bytes, so a
// response never streams a whole file through a serverless function.
const RESPONSE_CHUNK_BYTES = 1024 * 1024;

type ByteRange = { start: number; end: number };

function error(code: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

function responseRangeFor(requestedRange: string, contentLength: number): ByteRange | null {
  const match = requestedRange.match(rangeSchema)!;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : contentLength - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= contentLength || requestedEnd < start || requestedEnd >= contentLength) return null;
  return { start, end: Math.min(requestedEnd, start + RESPONSE_CHUNK_BYTES - 1) };
}

function fetchAudio(url: string, start: number, end: number) {
  return fetch(url, { cache: "no-store", headers: { Range: `bytes=${start}-${end}` } });
}

function unsatisfiable(target: YouTubeAudioTarget) {
  return error("RANGE_NOT_SATISFIABLE", "This audio range is unavailable.", 416, { "Content-Range": `bytes */${target.contentLength}` });
}

// Some fallback clients only serve small upstream ranges; stitch consecutive
// pieces into one response so the browser doesn't need hundreds of requests.
function stitchedBody(first: ReadableStream<Uint8Array>, target: YouTubeAudioTarget, range: ByteRange) {
  let nextStart = range.start + target.maxRangeBytes;
  let current: ReadableStreamDefaultReader<Uint8Array> | undefined = first.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (current) {
        const { done, value } = await current.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }
        current = undefined;
        if (nextStart > range.end) break;
        const end = Math.min(range.end, nextStart + target.maxRangeBytes - 1);
        const piece = await fetchAudio(target.url, nextStart, end);
        if (!piece.ok || !piece.body) throw new Error(`Audio piece returned ${piece.status}`);
        current = piece.body.getReader();
        nextStart = end + 1;
      }
      controller.close();
    },
    async cancel(reason) {
      await current?.cancel(reason);
    },
  });
}

export async function GET(request: NextRequest) {
  const videoId = videoIdSchema.safeParse(request.nextUrl.searchParams.get("videoId"));
  if (!videoId.success) return error("INVALID_VIDEO", "This audio link is invalid.", 400);

  // Without a Range header, answer the first chunk as a 206 so the browser keeps requesting ranges.
  const requestedRange = request.headers.get("range") ?? "bytes=0-";
  if (!rangeSchema.test(requestedRange)) return error("INVALID_RANGE", "This audio range is invalid.", 416);

  const actor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(`youtube-audio:${actor}`, 600, 60 * 1000).allowed) {
    return error("RATE_LIMITED", "Too many audio requests.", 429);
  }

  try {
    let target = await resolveYouTubeAudio(videoId.data);
    let range = responseRangeFor(requestedRange, target.contentLength);
    if (!range) return unsatisfiable(target);
    let upstream = await fetchAudio(target.url, range.start, Math.min(range.end, range.start + target.maxRangeBytes - 1));
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel().catch(() => undefined);
      target = await resolveYouTubeAudio(videoId.data, true);
      range = responseRangeFor(requestedRange, target.contentLength);
      if (!range) return unsatisfiable(target);
      upstream = await fetchAudio(target.url, range.start, Math.min(range.end, range.start + target.maxRangeBytes - 1));
    }
    if (!upstream.ok || !upstream.body) throw new Error(`Audio stream returned ${upstream.status}`);
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Type": target.mimeType,
      "X-Content-Type-Options": "nosniff",
    });
    if (range.end - range.start + 1 <= target.maxRangeBytes) {
      for (const name of ["content-length", "content-range"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    }
    if (upstream.status !== 206) throw new Error(`Audio stream ignored the range (${upstream.status})`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${target.contentLength}`);
    return new Response(stitchedBody(upstream.body, target, range), { status: 206, headers });
  } catch (cause) {
    console.error("YouTube audio stream unavailable", {
      videoId: videoId.data,
      cause: cause instanceof Error ? cause.message : "Unknown error",
    });
    return error("AUDIO_UNAVAILABLE", "This YouTube audio stream is temporarily unavailable.", 502);
  }
}
