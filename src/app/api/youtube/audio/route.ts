import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveYouTubeAudio } from "@/lib/youtube-audio";

const videoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const rangeSchema = /^bytes=(\d+)-(\d*)$/;

function error(code: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

function upstreamRangeFor(requestedRange: string | null, contentLength: number, maxRangeBytes: number) {
  if (!requestedRange) return undefined;
  const match = requestedRange.match(rangeSchema)!;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : contentLength - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= contentLength || requestedEnd < start || requestedEnd >= contentLength) return null;
  return `bytes=${start}-${Math.min(requestedEnd, start + maxRangeBytes - 1)}`;
}

function fetchAudio(url: string, range: string | undefined) {
  return fetch(url, {
    cache: "no-store",
    headers: range ? { Range: range } : undefined,
  });
}

export async function GET(request: NextRequest) {
  const videoId = videoIdSchema.safeParse(request.nextUrl.searchParams.get("videoId"));
  if (!videoId.success) return error("INVALID_VIDEO", "This audio link is invalid.", 400);

  const requestedRange = request.headers.get("range");
  if (requestedRange && !rangeSchema.test(requestedRange)) return error("INVALID_RANGE", "This audio range is invalid.", 416);

  const actor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(`youtube-audio:${actor}`, 120, 60 * 1000).allowed) {
    return error("RATE_LIMITED", "Too many audio requests.", 429);
  }

  try {
    let target = await resolveYouTubeAudio(videoId.data);
    let upstreamRange = upstreamRangeFor(requestedRange, target.contentLength, target.maxRangeBytes);
    if (upstreamRange === null) return error("RANGE_NOT_SATISFIABLE", "This audio range is unavailable.", 416, { "Content-Range": `bytes */${target.contentLength}` });
    let upstream = await fetchAudio(target.url, upstreamRange);
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel().catch(() => undefined);
      target = await resolveYouTubeAudio(videoId.data, true);
      upstreamRange = upstreamRangeFor(requestedRange, target.contentLength, target.maxRangeBytes);
      if (upstreamRange === null) return error("RANGE_NOT_SATISFIABLE", "This audio range is unavailable.", 416, { "Content-Range": `bytes */${target.contentLength}` });
      upstream = await fetchAudio(target.url, upstreamRange);
    }
    if (!upstream.ok || !upstream.body) throw new Error("Audio stream unavailable");
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Type": target.mimeType,
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["content-length", "content-range"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return error("AUDIO_UNAVAILABLE", "This YouTube audio stream is temporarily unavailable.", 502);
  }
}
