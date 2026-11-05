import { describe, expect, it } from "vitest";
import { mergeSearchSources } from "@/lib/search-client";
import { expectedResultPosition, searchEvaluationCases } from "@/lib/search-evaluation";
import type { Track } from "@/lib/types";

const track = (id: string, source: Track["source"]): Track => ({ id: `${source}:${id}`, providerTrackId: id, source, title: id, artist: "Artist", genres: [], playable: true, youtubeVideoId: source === "youtube" ? id : undefined });

describe("provider-aware search ordering", () => {
  it("preserves YouTube provider order before Archive and library results", () => {
    const youtube = [track("first", "youtube"), track("second", "youtube")];
    const results = mergeSearchSources(youtube, [track("archive", "archive")], [track("local", "local")]);
    expect(results.map((item) => item.id)).toEqual(["youtube:first", "youtube:second", "archive:archive", "local:local"]);
  });

  it("deduplicates without moving the first provider result", () => {
    const first = track("same", "youtube");
    expect(mergeSearchSources([first], [first, track("other", "archive")])).toEqual([first, track("other", "archive")]);
  });

  it("covers exact, artist/title, misspelling, Bangla, and international evaluation intents", () => {
    expect(searchEvaluationCases.map((item) => item.id)).toEqual(["exact-title", "artist-title", "misspelling", "bangla", "international"]);
    expect(expectedResultPosition([track("one", "youtube"), track("target", "youtube")], "target")).toBe(2);
  });
});
