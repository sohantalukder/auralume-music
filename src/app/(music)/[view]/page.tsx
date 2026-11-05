import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScreenRouter } from "@/components/screens/screen-router";

const views = new Set(["home", "discover", "search", "library", "liked", "recent", "playlists", "queue", "player", "settings", "profile", "privacy"]);
const viewTitles: Record<string, string> = {
  home: "Home", discover: "Discover", search: "Search", library: "Your library", liked: "Liked songs", recent: "Recently played",
  playlists: "Playlists", queue: "Queue", player: "Now playing", settings: "Settings", profile: "Profile", privacy: "Privacy",
};

export async function generateMetadata({ params }: { params: Promise<{ view: string }> }): Promise<Metadata> {
  const { view } = await params;
  return { title: viewTitles[view] ?? "Music" };
}

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!views.has(view)) notFound();
  return <ScreenRouter view={view} />;
}
