import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { LyricsResult } from "@/lib/types";
import { checkRateLimit } from "@/lib/rate-limit";

const lyricsSchema = z.object({
  title: z.string().trim().min(1).max(140),
  artist: z.string().trim().min(1).max(140),
  album: z.string().trim().max(140).optional(),
  duration: z.coerce.number().int().min(1).max(7200).optional(),
});

type LrcLibResponse = { instrumental?: boolean; plainLyrics?: string | null; syncedLyrics?: string | null };

export async function GET(request: NextRequest) {
  const parsed = lyricsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_LYRICS_QUERY", message: "Track and artist are required." } }, { status: 400 });
  const actor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`lyrics:${actor}`, 30, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Lyrics lookup limit reached." } }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });

  const params = new URLSearchParams({ track_name: parsed.data.title, artist_name: parsed.data.artist });
  if (parsed.data.album) params.set("album_name", parsed.data.album);
  if (parsed.data.duration) params.set("duration", String(parsed.data.duration));
  try {
    const response = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "Auralume/0.1 (https://sohantalukder.github.io)" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86_400 },
    });
    if (response.status === 404) return NextResponse.json({ error: { code: "LYRICS_NOT_FOUND", message: "Lyrics are not available for this track." } }, { status: 404 });
    if (response.status === 429) return NextResponse.json({ error: { code: "UPSTREAM_RATE_LIMITED", message: "Lyrics are busy. Try again shortly." } }, { status: 429, headers: { "Retry-After": response.headers.get("retry-after") || "60" } });
    if (!response.ok) throw new Error("lyrics unavailable");
    const body = (await response.json()) as LrcLibResponse;
    const result: LyricsResult = {
      instrumental: body.instrumental === true,
      plainLyrics: body.plainLyrics || undefined,
      syncedLyrics: body.syncedLyrics || undefined,
      sourceUrl: "https://lrclib.net",
    };
    return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ error: { code: "LYRICS_UNAVAILABLE", message: "Lyrics are temporarily unavailable." } }, { status: 502 });
  }
}
