"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileAudio, Headphones, Music2, Play, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TrackCard } from "@/components/track-card";
import { TrackRow } from "@/components/track-row";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { emptyPersonalizationProfile, loadPersonalizationProfile, recommendTracks, recordRecommendationSignal, subscribeToPersonalizationChanges } from "@/lib/personalization";
import { fetchYouTubeSearch } from "@/lib/search-client";
import type { PersonalizationProfile, Track } from "@/lib/types";
import { greeting } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";

async function trendingTracks(): Promise<Track[]> {
  const response = await fetch("/api/archive");
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Online music is temporarily unavailable.");
  return body.data ?? [];
}

export function DashboardScreen({ discover = false }: { discover?: boolean }) {
  const router = useRouter();
  const { data = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ["archive-trending"], queryFn: trendingTracks });
  const play = usePlayerStore((state) => state.play);
  const localTracks = usePlayerStore((state) => state.localTracks);
  const syncedTracks = usePlayerStore((state) => state.syncedTracks);
  const history = usePlayerStore((state) => state.history);
  const preferences = usePlayerStore((state) => state.preferences);
  const [profile, setProfile] = useState<PersonalizationProfile>(emptyPersonalizationProfile);
  const impressed = useRef(new Set<string>());
  const preferenceQueries = useMemo(() => [
    ...preferences.artists,
    ...preferences.genres.map((genre) => `${genre} music`),
    ...preferences.languages.map((language) => `${language} music`),
  ].slice(0, 4), [preferences]);
  const preferenceDiscovery = useQuery({
    queryKey: ["preference-discovery", preferenceQueries],
    queryFn: async ({ signal }) => {
      const groups = await Promise.all(preferenceQueries.map((query) => fetchYouTubeSearch(query, signal)));
      return groups.flat().filter((track, index, all) => all.findIndex((item) => item.id === track.id) === index);
    },
    enabled: !discover && preferenceQueries.length > 0,
  });
  const featured = data.length ? data[profile.searches.length % data.length] : undefined;

  useEffect(() => {
    let active = true;
    const refresh = () => { void loadPersonalizationProfile().then((next) => { if (active) setProfile(next); }); };
    refresh();
    const unsubscribe = subscribeToPersonalizationChanges(refresh);
    return () => { active = false; unsubscribe(); };
  }, []);

  const latestSearch = profile.searches.find((search) => search.tracks?.length);
  const recommendations = useMemo(() => {
    const searchedTracks = profile.searches.flatMap((search) => search.tracks ?? []);
    const candidates = [...(preferenceDiscovery.data ?? []), ...syncedTracks, ...localTracks, ...searchedTracks, ...data]
      .filter((track, index, all) => all.findIndex((item) => item.id === track.id) === index);
    return recommendTracks(candidates, profile, 8, preferences);
  }, [data, localTracks, preferenceDiscovery.data, preferences, profile, syncedTracks]);
  const preferenceRecommendations = useMemo(() => recommendTracks(preferenceDiscovery.data ?? [], profile, 6, preferences), [preferenceDiscovery.data, preferences, profile]);
  const newDiscoveries = useMemo(() => recommendTracks(data.filter((track) => !history.some((item) => item.id === track.id)), profile, 8, preferences), [data, history, preferences, profile]);
  useEffect(() => {
    // Recommendations recompute often; count each track as shown once per visit.
    for (const track of recommendations.slice(0, 6)) {
      if (impressed.current.has(track.id)) continue;
      impressed.current.add(track.id);
      void recordRecommendationSignal("impression", track).catch(() => undefined);
    }
  }, [recommendations]);

  const forYou = discover ? data : recommendations;
  const forYouTitle = discover ? "Popular open music" : latestSearch ? `Because you searched for “${latestSearch.query}”` : "Made for your listening";

  if (discover) return <div className="page-stack">
    <section className="welcome-row"><div><span className="eyebrow"><Sparkles size={14} /> Open music</span><h1>Discover independent music.</h1><p>Browse licensed open audio from Internet Archive.</p></div></section>
    {isLoading && <DashboardSkeleton />}
    {!isLoading && !isError && !data.length && <div className="empty-state"><Music2 /><h3>No open music right now</h3><p>The Internet Archive catalog returned nothing. Try again in a moment.</p></div>}
    {isError && <div className="provider-notice source-error"><span>{error.message}</span><Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw size={14} /> Retry</Button></div>}
    {data.length > 0 && <Shelf eyebrow="Online catalog" icon={<Headphones size={14} />} title={forYouTitle} tracks={data.slice(0, 12)} context={data} />}
    {data.length > 0 && <section><div className="section-heading"><div><span className="eyebrow"><Music2 size={14} /> Internet Archive</span><h2>Online tracks</h2><p>Every downloadable track includes its open-license source.</p></div></div><div className="track-list">{data.slice(0, 12).map((track, index) => <TrackRow key={track.id} track={track} context={data} index={index} />)}</div></section>}
  </div>;

  return <div className="page-stack home">
    <header className="home-header">
      <span className="home-greeting">{greeting()}</span>
      <h1>Home</h1>
      <nav className="mood-chips" aria-label="Moods">{moods.map((mood) => <Link key={mood.label} href={`/search?q=${encodeURIComponent(mood.query)}`} style={{ "--chip-hue": mood.hue } as React.CSSProperties}>{mood.label}</Link>)}</nav>
    </header>
    {featured && <section className="spotlight" style={{ "--spotlight-art": `url("${featured.artwork || "/artwork/local.svg"}")` } as React.CSSProperties}>
      <img src={featured.artwork || "/artwork/local.svg"} alt="" />
      <div><span className="eyebrow">Top pick</span><h2>{featured.title}</h2><p>{featured.artist}{featured.album ? ` · ${featured.album}` : ""}</p><div className="spotlight-actions"><Button onClick={() => play(featured, data)}><Play size={17} fill="currentColor" /> Play now</Button><Button variant="secondary" onClick={() => router.push("/discover")}>Explore <ArrowRight size={16} /></Button></div></div>
    </section>}
    {isLoading && <DashboardSkeleton />}
    {isError && <div className="provider-notice source-error"><span>{error.message}</span><Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw size={14} /> Retry</Button></div>}
    {history.length > 0 && <Shelf eyebrow="Continue listening" icon={null} title="Recently played" link={{ href: "/recent", label: "See all" }} tracks={history.slice(0, 12)} context={history} />}
    {preferenceRecommendations.length > 0 && <Shelf eyebrow="Your choices" icon={<Sparkles size={14} />} title="Based on your preferences" link={{ href: "/settings", label: "Edit" }} tracks={preferenceRecommendations} context={preferenceRecommendations} />}
    {forYou.length > 0 && <Shelf eyebrow="For you" icon={<Headphones size={14} />} title={forYouTitle} link={{ href: "/discover", label: "See all" }} tracks={forYou.slice(0, 12)} context={forYou} />}
    {newDiscoveries.length > 0 && <section><div className="section-heading"><div><span className="eyebrow"><Music2 size={14} /> Fresh rotation</span><h2>New discoveries</h2></div></div><div className="track-list">{newDiscoveries.slice(0, 6).map((track, index) => <TrackRow key={track.id} track={track} context={newDiscoveries} index={index} />)}</div></section>}
    {!isLoading && !isError && !data.length && !history.length && <div className="empty-state"><Music2 /><h3>Start with a mood</h3><p>Pick a mood above or search for any song.</p></div>}
    <section className="local-option"><div><span className="eyebrow"><FileAudio size={14} /> Optional</span><h2>Add music from this device</h2><p>MP3, AAC, WAV, and OGG files stay inside this browser.</p></div><Link href="/library" className="action-chip">Open local library <ArrowRight size={15} /></Link></section>
  </div>;
}

const moods = [
  { label: "Chill", query: "chill vibes", hue: "200deg" },
  { label: "Focus", query: "lofi focus", hue: "265deg" },
  { label: "Bangla", query: "bangla songs", hue: "330deg" },
  { label: "Romantic", query: "romantic songs", hue: "350deg" },
  { label: "Workout", query: "workout music", hue: "20deg" },
  { label: "Indie", query: "indie music", hue: "150deg" },
  { label: "Jazz", query: "jazz classics", hue: "45deg" },
  { label: "Sleep", query: "sleep music", hue: "230deg" },
];

function Shelf({ eyebrow, icon, title, link, tracks, context }: { eyebrow: string; icon: React.ReactNode; title: string; link?: { href: string; label: string }; tracks: Track[]; context: Track[] }) {
  return <section className="shelf-section">
    <div className="section-heading"><div><span className="eyebrow">{icon} {eyebrow}</span><h2>{title}</h2></div>{link && <Link href={link.href}>{link.label} <ArrowRight size={15} /></Link>}</div>
    <div className="card-grid shelf">{tracks.map((track) => <TrackCard key={track.id} track={track} context={context} />)}</div>
  </section>;
}
