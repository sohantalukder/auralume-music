import { describe, expect, it } from "vitest";
import { normalizeYouTubeLibrary } from "@/lib/youtube-library";

describe("YouTube library normalization", () => {
  it("deduplicates tracks while preserving playlist membership", () => {
    const library = normalizeYouTubeLibrary([
      { id: "one", title: "Focus", items: [{ videoId: "abcdefghijk", title: "First song", artist: "Artist" }] },
      { id: "two", title: "Favourites", items: [{ videoId: "abcdefghijk", title: "First song", artist: "Artist" }] },
    ]);

    expect(library.tracks).toHaveLength(1);
    expect(library.tracks[0].genres).toEqual(["Focus", "Favourites"]);
    expect(library.playlists.map((playlist) => playlist.trackIds)).toEqual([["youtube:abcdefghijk"], ["youtube:abcdefghijk"]]);
  });

  it("drops private and deleted placeholders", () => {
    const library = normalizeYouTubeLibrary([{ id: "one", title: "Hidden", items: [
      { videoId: "abcdefghijk", title: "Private video" },
      { videoId: "lmnopqrstuv", title: "Deleted video" },
    ] }]);
    expect(library.tracks).toEqual([]);
    expect(library.playlists[0].trackIds).toEqual([]);
  });
});
