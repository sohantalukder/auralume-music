"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileAudio, Headphones, History, Music2, Play, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  useEffect(() => { recommendations.slice(0, 6).forEach((track) => void recordRecommendationSignal("impression", track).catch(() => undefined)); }, [recommendations]);

  return <div className="page-stack">
    <section className="welcome-row"><div><span className="eyebrow"><Sparkles size={14} /> {discover ? "Open music" : greeting()}</span><h1>{discover ? "Discover independent music." : "Music that changes with you."}</h1><p>{discover ? "Browse licensed open audio from Internet Archive." : "Your home updates from searches, listening, likes, skips, and the preferences you choose."}</p></div></section>
    {featured && <section className="hero-release"><div className="hero-noise" /><div className="hero-copy"><span>Today’s open-audio pick</span><h2>{featured.title}</h2><p>{featured.artist} · {featured.album || "Internet Archive"}</p><div><Button onClick={() => play(featured, data)}><Play size={17} fill="currentColor" /> Play now</Button><Button className="hero-secondary" variant="secondary" onClick={() => router.push("/discover")}>Explore catalog <ArrowRight size={16} /></Button></div></div><img src={featured.artwork || "/artwork/local.svg"} alt="" /></section>}
    {isLoading && <DashboardSkeleton />}
    {isError && <div className="provider-notice source-error"><span>{error.message}</span><Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw size={14} /> Retry</Button></div>}
    {!discover && history.length > 0 && <section><div className="section-heading"><div><span className="eyebrow"><History size={14} /> Continue listening</span><h2>Recently played</h2><p>Pick up where you left off on this browser.</p></div><Link href="/recent">See all <ArrowRight size={15} /></Link></div><div className="card-grid">{history.slice(0, 6).map((track) => <TrackCard key={track.id} track={track} context={history} />)}</div></section>}
    {!discover && preferenceRecommendations.length > 0 && <section><div className="section-heading"><div><span className="eyebrow"><Sparkles size={14} /> Your choices</span><h2>Based on your preferences</h2><p>New candidates from your favorite artists, genres, and languages.</p></div><Link href="/settings">Edit preferences <ArrowRight size={15} /></Link></div><div className="card-grid">{preferenceRecommendations.map((track) => <TrackCard key={track.id} track={track} context={preferenceRecommendations} />)}</div></section>}
    {(discover ? data : recommendations).length > 0 && <section><div className="section-heading"><div><span className="eyebrow"><Headphones size={14} /> {discover ? "Online catalog" : "For you"}</span><h2>{discover ? "Popular open music" : latestSearch ? `Because you searched for “${latestSearch.query}”` : "Made for your listening"}</h2><p>{discover ? "Playable open-license MP3 audio." : "Ranked from the signals stored on this browser, with repeated artists limited."}</p></div>{!discover && <Link href="/discover">See all <ArrowRight size={15} /></Link>}</div><div className="card-grid">{(discover ? data : recommendations).slice(0, 6).map((track) => <TrackCard key={track.id} track={track} context={discover ? data : recommendations} />)}</div></section>}
    {!discover && newDiscoveries.length > 0 && <section><div className="section-heading"><div><span className="eyebrow"><Music2 size={14} /> Fresh rotation</span><h2>New discoveries</h2><p>Open music you have not played recently.</p></div></div><div className="track-list">{newDiscoveries.slice(0, 8).map((track, index) => <TrackRow key={track.id} track={track} context={newDiscoveries} index={index} />)}</div></section>}
    {discover && data.length > 0 && <section><div className="section-heading"><div><span className="eyebrow"><Music2 size={14} /> Internet Archive</span><h2>Online tracks</h2><p>Every downloadable track includes its open-license source.</p></div></div><div className="track-list">{data.slice(0, 12).map((track, index) => <TrackRow key={track.id} track={track} context={data} index={index} />)}</div></section>}
    <section className="local-option"><div><span className="eyebrow"><FileAudio size={14} /> Optional</span><h2>Add music from this device</h2><p>MP3, AAC, WAV, and OGG files stay inside this browser.</p></div><Link href="/library" className="action-chip">Open local library <ArrowRight size={15} /></Link></section>
  </div>;
}
