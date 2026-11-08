import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, normalizeYouTubeSearchHtml } from "@/lib/youtube";

function page(data: unknown) {
  return `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
}

const playable = {
  videoRenderer: {
    videoId: "IF9GJstin2g",
    title: { runs: [{ text: "Ami Shunechi Sedin Tumi" }] },
    ownerText: { runs: [{ text: "Music Channel" }] },
    lengthText: { simpleText: "4:20" },
  },
};

describe("YouTube search normalization", () => {
  it("extracts bounded, playable video results from initial data", () => {
    const tracks = normalizeYouTubeSearchHtml(page({ contents: [{ shelf: playable }, { duplicate: playable }] }));
    expect(tracks).toEqual([expect.objectContaining({
      id: "youtube:IF9GJstin2g",
      source: "youtube",
      title: "Ami Shunechi Sedin Tumi",
      artist: "Music Channel",
      duration: 260,
      youtubeVideoId: "IF9GJstin2g",
      streamUrl: "/api/youtube/audio?videoId=IF9GJstin2g",
      playable: true,
    })]);
    expect(tracks[0].artwork).toBe("https://i.ytimg.com/vi/IF9GJstin2g/hqdefault.jpg");
  });

  it("excludes live, malformed, and non-video results", () => {
    const tracks = normalizeYouTubeSearchHtml(page({ contents: [
      { videoRenderer: { ...playable.videoRenderer, videoId: "bad", title: { runs: [{ text: "Bad" }] } } },
      { videoRenderer: { ...playable.videoRenderer, videoId: "3I34gwziFpY", lengthText: undefined, badges: [{ metadataBadgeRenderer: { label: "LIVE" } }] } },
      { playlistRenderer: { playlistId: "PL123" } },
    ] }));
    expect(tracks).toEqual([]);
  });

  it("preserves provider results when optional artist or duration metadata is absent", () => {
    const tracks = normalizeYouTubeSearchHtml(page({ contents: [{ videoRenderer: { videoId: "3I34gwziFpY", title: { runs: [{ text: "Rare recording" }] } } }] }));
    expect(tracks[0]).toMatchObject({ title: "Rare recording", artist: "YouTube creator", genres: [], playable: true });
    expect(tracks[0].duration).toBeUndefined();
  });

  it("fails closed when YouTube does not return initial search data", () => {
    expect(() => normalizeYouTubeSearchHtml("<html>consent required</html>")).toThrow("search data");
  });

  it("decodes HTML entities that the Data API leaves in titles", () => {
    expect(decodeHtmlEntities("Calm &amp; Collected &quot;Lo-Fi&quot; 90&#39;s &#x1F3B5;")).toBe("Calm & Collected \"Lo-Fi\" 90's 🎵");
    expect(decodeHtmlEntities("Tom &unknown; Jerry")).toBe("Tom &unknown; Jerry");
  });
});
