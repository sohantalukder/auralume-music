import { describe, expect, it } from "vitest";
import { emptyPersonalizationProfile, rankTracks, recommendTracks, scoreTrack } from "@/lib/personalization";
import type { PersonalizationProfile, Track } from "@/lib/types";

const localTracks: Track[] = [
  { id: "local:ambient", providerTrackId: "ambient", source: "local", title: "Ambient Distance", artist: "Local artist", genres: ["ambient"], playable: true, streamUrl: "blob:ambient" },
  { id: "local:focus", providerTrackId: "focus", source: "local", title: "Focus Track", artist: "Local artist", genres: ["focus"], playable: true, streamUrl: "blob:focus" },
];

describe("personalization ranking", () => {
  it("puts an exact title match before a generic match", () => {
    const ranked = rankTracks([localTracks[1], localTracks[0]], emptyPersonalizationProfile, "Ambient Distance");
    expect(ranked[0].id).toBe("local:ambient");
  });

  it("applies category affinity and time-decayed behavior signals", () => {
    const profile: PersonalizationProfile = {
      searches: [],
      categories: [{ category: "focus", score: 10, updatedAt: new Date().toISOString() }],
      signals: [{ id: "liked", kind: "like", trackId: localTracks[1].id, categories: ["focus"], createdAt: new Date().toISOString() }],
    };
    expect(scoreTrack(localTracks[1], profile)).toBeGreaterThan(scoreTrack(localTracks[0], profile));
  });

  it("keeps recommendation results diverse before filling remaining slots", () => {
    const tracks: Track[] = Array.from({ length: 6 }, (_, index) => ({ ...localTracks[0], id: `local:ambient-${index}`, title: `Ambient ${index}` }));
    tracks.push({ ...localTracks[1], id: "local:focus-one", title: "Focus one" });
    const recommended = recommendTracks(tracks, emptyPersonalizationProfile, 4);
    expect(recommended.some((track) => track.id === "local:focus-one")).toBe(true);
  });

  it("uses recent search terms to raise matching home recommendations", () => {
    const profile: PersonalizationProfile = {
      searches: [{ id: "search", query: "ambient", resultIds: [], createdAt: new Date().toISOString() }],
      categories: [],
      signals: [],
    };
    expect(scoreTrack(localTracks[0], profile)).toBeGreaterThan(scoreTrack(localTracks[1], profile));
  });

  it("raises tracks returned by a recent search even when their title does not repeat the query", () => {
    const profile: PersonalizationProfile = {
      searches: [{ id: "search", query: "late night songs", resultIds: [localTracks[1].id], tracks: [localTracks[1]], createdAt: new Date().toISOString() }],
      categories: [],
      signals: [],
    };
    expect(scoreTrack(localTracks[1], profile)).toBeGreaterThan(scoreTrack(localTracks[0], profile));
  });
});
