import type { Track } from "@/lib/types";

export const searchEvaluationCases = [
  { id: "exact-title", query: "Bohemian Rhapsody", intent: "exact title" },
  { id: "artist-title", query: "Nina Simone Feeling Good", intent: "artist and title" },
  { id: "misspelling", query: "ami suneci sedin tumi", intent: "common transliteration spelling" },
  { id: "bangla", query: "আমার সোনার বাংলা", intent: "Bangla script" },
  { id: "international", query: "Dernière danse Indila", intent: "international title and artist" },
] as const;

export function expectedResultPosition(results: Track[], expectedVideoId: string) {
  const index = results.findIndex((track) => track.youtubeVideoId === expectedVideoId);
  return index < 0 ? undefined : index + 1;
}
