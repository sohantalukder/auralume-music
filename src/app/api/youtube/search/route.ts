import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeYouTubeDataApiItems, normalizeYouTubeSearchHtml } from "@/lib/youtube";

const querySchema = z.string().trim().min(2).max(80);
const pageTokenSchema = z.string().trim().max(512).optional();
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!query.success) return NextResponse.json({ error: { code: "INVALID_QUERY", message: "Enter between 2 and 80 characters." } }, { status: 400 });

  const actor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(`youtube-search:${actor}`, 30, 60 * 1000).allowed) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many YouTube searches." } }, { status: 429 });
  }

  try {
    const pageToken = pageTokenSchema.safeParse(request.nextUrl.searchParams.get("pageToken") || undefined);
    if (!pageToken.success) return NextResponse.json({ error: { code: "INVALID_PAGE", message: "The search page is invalid." } }, { status: 400 });
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      const apiParams = new URLSearchParams({ part: "snippet", type: "video", maxResults: "20", q: query.data, key: apiKey });
      if (pageToken.data) apiParams.set("pageToken", pageToken.data);
      const apiResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${apiParams}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!apiResponse.ok) throw new Error("official search unavailable");
      const apiBody = await apiResponse.json() as { items?: unknown[]; nextPageToken?: string };
      return NextResponse.json({ data: normalizeYouTubeDataApiItems(apiBody), provider: "youtube-data-api", nextPageToken: apiBody.nextPageToken }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (pageToken.data) return NextResponse.json({ data: [], provider: "youtube", limitation: "Pagination requires YOUTUBE_API_KEY" }, { headers: { "Cache-Control": "private, no-store" } });
    const params = new URLSearchParams({ search_query: query.data, hl: "en", persist_hl: "1" });
    const response = await fetch(`https://www.youtube.com/results?${params}`, {
      cache: "no-store",
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; Auralume-Music/1.0; +https://github.com/)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("search unavailable");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error("search response too large");
    const html = await response.text();
    if (html.length > MAX_RESPONSE_BYTES) throw new Error("search response too large");
    return NextResponse.json({ data: normalizeYouTubeSearchHtml(html), provider: "youtube" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "YOUTUBE_UNAVAILABLE", message: "YouTube search is temporarily unavailable." } }, { status: 502 });
  }
}
