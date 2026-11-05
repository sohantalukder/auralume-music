import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { archiveMetadataResponseSchema, MAX_ARCHIVE_MP3_BYTES, resolveArchiveDownload } from "@/lib/archive";
import { checkRateLimit } from "@/lib/rate-limit";

const identifierSchema = z.string().regex(/^[A-Za-z0-9._-]{1,120}$/);
const fileSchema = z.string().min(1).max(500);

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: NextRequest) {
  const identifier = identifierSchema.safeParse(request.nextUrl.searchParams.get("identifier"));
  const file = fileSchema.safeParse(request.nextUrl.searchParams.get("file"));
  if (!identifier.success || !file.success) return error("INVALID_DOWNLOAD", "This MP3 download link is invalid.", 400);

  const actor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(`archive-download:${actor}`, 12, 60 * 1000).allowed) {
    return error("RATE_LIMITED", "Too many download requests.", 429);
  }

  try {
    const metadataResponse = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier.data)}`, {
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!metadataResponse.ok) throw new Error("metadata unavailable");
    const metadata = archiveMetadataResponseSchema.parse(await metadataResponse.json());
    const target = resolveArchiveDownload(metadata, identifier.data, file.data);
    if (!target) return error("DOWNLOAD_NOT_ALLOWED", "This licensed MP3 is no longer available for download.", 404);

    const audioResponse = await fetch(target.url, { cache: "no-store" });
    if (!audioResponse.ok || !audioResponse.body) throw new Error("audio unavailable");
    const rawContentLength = audioResponse.headers.get("content-length");
    const contentLength = rawContentLength === null ? undefined : Number(rawContentLength);
    if (contentLength !== undefined && (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_ARCHIVE_MP3_BYTES)) {
      return error("DOWNLOAD_NOT_ALLOWED", "This MP3 is too large to download through Auralume.", 413);
    }

    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(target.fileName),
      "Content-Type": "audio/mpeg",
      "X-Content-Type-Options": "nosniff",
    });
    if (contentLength !== undefined) headers.set("Content-Length", String(contentLength));
    return new Response(audioResponse.body, { status: 200, headers });
  } catch {
    return error("DOWNLOAD_UNAVAILABLE", "This MP3 could not be downloaded right now.", 502);
  }
}
