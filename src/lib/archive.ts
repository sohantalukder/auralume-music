import { z } from "zod";
import type { Track } from "@/lib/types";

const textOrTexts = z.union([z.string(), z.array(z.string())]).optional();
export const MAX_ARCHIVE_MP3_BYTES = 150 * 1024 * 1024;

export const archiveSearchResponseSchema = z.object({
  response: z.object({
    numFound: z.number().int().nonnegative(),
    docs: z.array(z.object({
      identifier: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/),
      title: z.string().optional(),
      creator: textOrTexts,
      description: textOrTexts,
      date: z.string().optional(),
      downloads: z.number().nonnegative().optional(),
      licenseurl: textOrTexts,
      subject: textOrTexts,
    }).passthrough()).max(12),
  }),
});

export const archiveMetadataResponseSchema = z.object({
  metadata: z.object({
    identifier: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/),
    title: z.string().optional(),
    creator: textOrTexts,
    date: z.string().optional(),
    licenseurl: textOrTexts,
    subject: textOrTexts,
  }).passthrough(),
  files: z.array(z.object({
    name: z.string().min(1).max(500),
    format: z.string().optional(),
    source: z.string().optional(),
    title: z.string().optional(),
    artist: z.string().optional(),
    creator: z.string().optional(),
    album: z.string().optional(),
    genre: z.string().optional(),
    length: z.union([z.string(), z.number()]).optional(),
    size: z.union([z.string(), z.number()]).optional(),
  }).passthrough()).max(120),
});

type SearchDocument = z.infer<typeof archiveSearchResponseSchema>["response"]["docs"][number];
type MetadataResponse = z.infer<typeof archiveMetadataResponseSchema>;

function firstText(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.find(Boolean) : value;
}

function authorizedLicense(value: string | string[] | undefined) {
  const candidate = firstText(value);
  if (!candidate) return;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLocaleLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return;
    if (!(["creativecommons.org", "www.creativecommons.org"].includes(host))) return;
    if (!url.pathname.startsWith("/licenses/") && !url.pathname.startsWith("/publicdomain/")) return;
    url.protocol = "https:";
    return { name: url.pathname.startsWith("/publicdomain/") ? "Public domain" : "Creative Commons", url: url.href };
  } catch {
    return;
  }
}

function tags(value: string | string[] | undefined, genre?: string) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set([genre, ...values.flatMap((item) => item.split(/[;,]/))].map((item) => item?.trim()).filter((item): item is string => Boolean(item)))].slice(0, 4);
}

function archiveFileUrl(identifier: string, name: string) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${name.split("/").map(encodeURIComponent).join("/")}`;
}

function isSafeArchiveMp3(file: MetadataResponse["files"][number]) {
  return file.name.toLocaleLowerCase().endsWith(".mp3")
    && Boolean(file.format?.toLocaleLowerCase().includes("mp3"))
    && file.name.split("/").every((segment) => Boolean(segment) && segment !== "." && segment !== "..")
    && Number(file.size) > 0
    && Number(file.size) <= MAX_ARCHIVE_MP3_BYTES;
}

export function resolveArchiveDownload(payload: MetadataResponse, identifier: string, fileName: string) {
  if (payload.metadata.identifier !== identifier || !authorizedLicense(payload.metadata.licenseurl)) return;
  const file = payload.files.find((candidate) => candidate.name === fileName && isSafeArchiveMp3(candidate));
  if (!file) return;
  return {
    url: archiveFileUrl(identifier, file.name),
    fileName: file.name.split("/").at(-1) || "audio.mp3",
    size: Number(file.size),
  };
}

export function normalizeArchiveItem(document: SearchDocument, payload: MetadataResponse): Track[] {
  if (payload.metadata.identifier !== document.identifier) return [];
  const license = authorizedLicense(payload.metadata.licenseurl ?? document.licenseurl);
  if (!license) return [];
  const creator = firstText(payload.metadata.creator ?? document.creator) || "Internet Archive artist";
  const album = payload.metadata.title ?? document.title ?? "Internet Archive";
  const files = payload.files
    .filter(isSafeArchiveMp3)
    .sort((a, b) => Number(b.source === "original") - Number(a.source === "original"))
    .slice(0, 4);

  return files.map((file) => {
    const duration = Number(file.length);
    return {
      id: `archive:${document.identifier}:${file.name}`,
      providerTrackId: `${document.identifier}/${file.name}`,
      source: "archive",
      title: file.title?.trim() || file.name.replace(/\.mp3$/i, "").replace(/[_-]+/g, " ").trim(),
      artist: file.artist?.trim() || file.creator?.trim() || creator,
      album: file.album?.trim() || album,
      artwork: `https://archive.org/services/img/${encodeURIComponent(document.identifier)}`,
      duration: Number.isFinite(duration) && duration > 0 && duration <= 7200 ? duration : undefined,
      createdAt: payload.metadata.date ?? document.date,
      popularity: document.downloads,
      genres: tags(payload.metadata.subject ?? document.subject, file.genre),
      playable: true,
      streamUrl: archiveFileUrl(document.identifier, file.name),
      downloadUrl: `/api/archive/download?${new URLSearchParams({ identifier: document.identifier, file: file.name })}`,
      originalUrl: `https://archive.org/details/${encodeURIComponent(document.identifier)}`,
      license,
    } satisfies Track;
  });
}

export function archiveSearchQuery(query?: string) {
  const playable = 'mediatype:audio AND format:"VBR MP3" AND licenseurl:* AND files_count:[1 TO 80]';
  // Keep the anonymous Home feed music-focused, but search the complete
  // licensed audio catalog so regional and less-common releases are visible.
  if (!query) return `collection:netlabels AND ${playable}`;
  const terms = query.trim().split(/\s+/).slice(0, 8).map((term) => `"${term.replace(/["\\]/g, "\\$&")}"`).join(" AND ");
  return `(${terms}) AND ${playable}`;
}
