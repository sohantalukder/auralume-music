import { describe, expect, it } from "vitest";
import { archiveSearchQuery, normalizeArchiveItem, resolveArchiveDownload } from "@/lib/archive";

const document = {
  identifier: "open-album",
  title: "Open Album",
  creator: ["Primary Artist", "Second Artist"],
  date: "2025-01-01",
  downloads: 123,
  licenseurl: "https://creativecommons.org/licenses/by/4.0/",
  subject: ["Electronic; Ambient"],
};

describe("Internet Archive normalization", () => {
  it("normalizes bounded MP3 files and prefers file metadata", () => {
    const tracks = normalizeArchiveItem(document, {
      metadata: { identifier: "open-album", title: "Open Album", creator: "Album Artist", licenseurl: document.licenseurl },
      files: [
        { name: "song_one.mp3", format: "VBR MP3", source: "original", title: "Song One", artist: "Track Artist", length: "180", size: "1000000", genre: "Downtempo" },
        { name: "cover.jpg", format: "JPEG", size: "2000" },
      ],
    });

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      id: "archive:open-album:song_one.mp3",
      source: "archive",
      title: "Song One",
      artist: "Track Artist",
      duration: 180,
      playable: true,
      license: { name: "Creative Commons" },
    });
    expect(tracks[0].streamUrl).toBe("https://archive.org/download/open-album/song_one.mp3");
    expect(tracks[0].downloadUrl).toBe("/api/archive/download?identifier=open-album&file=song_one.mp3");
    expect(tracks[0].genres).toContain("Downtempo");
  });

  it("resolves only exact, licensed, bounded MP3 download targets", () => {
    const payload = {
      metadata: { identifier: "open-album", licenseurl: document.licenseurl },
      files: [{ name: "folder/song one.mp3", format: "VBR MP3", size: "1000" }],
    };
    expect(resolveArchiveDownload(payload, "open-album", "folder/song one.mp3")).toEqual({
      url: "https://archive.org/download/open-album/folder/song%20one.mp3",
      fileName: "song one.mp3",
      size: 1000,
    });
    expect(resolveArchiveDownload(payload, "open-album", "folder/other.mp3")).toBeUndefined();
    expect(resolveArchiveDownload({ ...payload, metadata: { identifier: "open-album" } }, "open-album", "folder/song one.mp3")).toBeUndefined();
  });

  it("rejects missing, unrelated, and mismatched license metadata", () => {
    const files = [{ name: "song.mp3", format: "VBR MP3", size: "1000" }];
    expect(normalizeArchiveItem({ ...document, licenseurl: undefined }, { metadata: { identifier: "open-album" }, files })).toEqual([]);
    expect(normalizeArchiveItem({ ...document, licenseurl: "https://example.com/license" }, { metadata: { identifier: "open-album" }, files })).toEqual([]);
    expect(normalizeArchiveItem(document, { metadata: { identifier: "another-album", licenseurl: document.licenseurl }, files })).toEqual([]);
  });

  it("upgrades legacy Creative Commons license links to HTTPS", () => {
    const [track] = normalizeArchiveItem({ ...document, licenseurl: "http://creativecommons.org/licenses/by/3.0/" }, {
      metadata: { identifier: "open-album" },
      files: [{ name: "song.mp3", format: "VBR MP3", size: "1000" }],
    });
    expect(track.license?.url).toBe("https://creativecommons.org/licenses/by/3.0/");
  });

  it("rejects non-MP3 and oversized files", () => {
    const tracks = normalizeArchiveItem(document, {
      metadata: { identifier: "open-album", licenseurl: "https://creativecommons.org/publicdomain/zero/1.0/" },
      files: [
        { name: "song.ogg", format: "Ogg Vorbis", size: "1000" },
        { name: "huge.mp3", format: "VBR MP3", size: String(151 * 1024 * 1024) },
      ],
    });
    expect(tracks).toEqual([]);
  });

  it("escapes quoted search terms and always applies the catalog constraints", () => {
    const query = archiveSearchQuery('night "drive"');
    expect(query).toContain('"night" AND "\\\"drive\\\""');
    expect(query).not.toContain("collection:netlabels");
    expect(query).toContain("mediatype:audio");
    expect(query).toContain("licenseurl:*");
    expect(archiveSearchQuery()).toContain("collection:netlabels");
  });
});
