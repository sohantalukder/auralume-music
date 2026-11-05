import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { archiveMetadataResponseSchema, archiveSearchQuery, archiveSearchResponseSchema, normalizeArchiveItem } from "@/lib/archive";
import { checkRateLimit } from "@/lib/rate-limit";

const querySchema = z.string().trim().min(2).max(80);

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("q");
  const query = rawQuery ? querySchema.safeParse(rawQuery) : null;
  const page = z.coerce.number().int().min(1).max(10).catch(1).parse(request.nextUrl.searchParams.get("page") ?? 1);
  if (query && !query.success) return NextResponse.json({ error: { code: "INVALID_QUERY", message: "Enter between 2 and 80 characters." } }, { status: 400 });

  const actor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(`archive:${actor}`, 60, 60 * 1000).allowed) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many catalog requests." } }, { status: 429 });

  const params = new URLSearchParams();
  params.set("q", archiveSearchQuery(query?.success ? query.data : undefined));
  const rows = query?.success ? 12 : 6;
  ["identifier", "title", "creator", "description", "date", "downloads", "licenseurl", "subject"].forEach((field) => params.append("fl[]", field));
  params.append("sort[]", "downloads desc");
  params.set("rows", String(rows));
  params.set("page", String(page));
  params.set("output", "json");

  try {
    const searchResponse = await fetch(`https://archive.org/advancedsearch.php?${params}`, { signal: AbortSignal.timeout(8_000), next: { revalidate: query ? 600 : 1800 } });
    if (!searchResponse.ok) throw new Error("catalog unavailable");
    const search = archiveSearchResponseSchema.parse(await searchResponse.json());
    const tracks = (await Promise.all(search.response.docs.map(async (document) => {
      try {
        const metadataResponse = await fetch(`https://archive.org/metadata/${encodeURIComponent(document.identifier)}`, { signal: AbortSignal.timeout(8_000), next: { revalidate: 3600 } });
        if (!metadataResponse.ok) return [];
        return normalizeArchiveItem(document, archiveMetadataResponseSchema.parse(await metadataResponse.json()));
      } catch {
        return [];
      }
    }))).flat().slice(0, 20);
    return NextResponse.json({ data: tracks, provider: "internet-archive", nextPage: search.response.numFound > page * rows ? page + 1 : undefined }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
  } catch {
    return NextResponse.json({ error: { code: "ARCHIVE_UNAVAILABLE", message: "The online music catalog is temporarily unavailable." } }, { status: 502 });
  }
}
