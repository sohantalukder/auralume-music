"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { History, Music2, RefreshCw, Search, WifiOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TrackRow } from "@/components/track-row";
import { Button } from "@/components/ui/button";
import { Skeleton, TrackListSkeleton } from "@/components/ui/skeleton";
import { APP_NAME } from "@/lib/brand";
import { emptyPersonalizationProfile, loadPersonalizationProfile, rankTracks, recordSearchEvent } from "@/lib/personalization";
import { fetchArchiveSearch, fetchYouTubeSearchPage, mergeSearchSources } from "@/lib/search-client";
import type { PersonalizationProfile } from "@/lib/types";
import { usePlayerStore } from "@/stores/player-store";

type SourceFilter = "all" | "youtube" | "archive" | "library";

export function SearchScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const localTracks = usePlayerStore((state) => state.localTracks);
  const syncedTracks = usePlayerStore((state) => state.syncedTracks);
  const [input, setInput] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(input.trim());
  const [profile, setProfile] = useState<PersonalizationProfile>(emptyPersonalizationProfile);
  const [online, setOnline] = useState(true);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [inputFocused, setInputFocused] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const recordedKey = useRef("");

  useEffect(() => { loadPersonalizationProfile().then(setProfile); }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    router.replace(`/search${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [query, router]);

  const onlineSearch = useInfiniteQuery({
    queryKey: ["archive-search", query],
    queryFn: ({ pageParam, signal }) => fetchArchiveSearch(query, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: query.length >= 2 && online,
  });
  const youtubeSearch = useInfiniteQuery({
    queryKey: ["youtube-search", query],
    queryFn: ({ pageParam, signal }) => fetchYouTubeSearchPage(query, signal, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    enabled: query.length >= 2 && online,
  });
  const archiveTracks = useMemo(() => onlineSearch.data?.pages.flatMap((page) => page.data) ?? [], [onlineSearch.data?.pages]);
  const localMatches = useMemo(() => {
    if (query.length < 2) return [];
    const value = query.toLocaleLowerCase();
    return [...localTracks, ...syncedTracks].filter((track) => `${track.title} ${track.artist} ${track.album || ""}`.toLocaleLowerCase().includes(value));
  }, [localTracks, query, syncedTracks]);
  const results = useMemo(() => {
    const youtube = youtubeSearch.data?.pages.flatMap((page) => page.data) ?? [];
    const archive = rankTracks(archiveTracks, profile, query);
    const library = rankTracks(localMatches, profile, query);
    const selected = sourceFilter === "youtube" ? youtube : sourceFilter === "archive" ? archive : sourceFilter === "library" ? library : [...youtube, ...archive, ...library];
    return mergeSearchSources(selected);
  }, [archiveTracks, localMatches, profile, query, sourceFilter, youtubeSearch.data?.pages]);

  useEffect(() => {
    if (query.length < 2 || (online && (!onlineSearch.isFetched || !youtubeSearch.isFetched))) return;
    const key = query.toLocaleLowerCase();
    if (recordedKey.current === key) return;
    recordedKey.current = key;
    void recordSearchEvent(query, undefined, results).then(() => loadPersonalizationProfile().then(setProfile)).catch(() => undefined);
  }, [online, onlineSearch.isFetched, query, results, youtubeSearch.isFetched]);

  const recent = useMemo(() => [...new Set(profile.searches.map((item) => item.query))].slice(0, 6), [profile.searches]);
  const suggestions = useMemo(() => {
    const value = input.trim().toLocaleLowerCase();
    if (!value) return [];
    const candidates = [
      ...recent,
      ...[...localTracks, ...syncedTracks, ...(youtubeSearch.data?.pages.flatMap((page) => page.data) ?? []), ...archiveTracks].flatMap((track) => [track.title, track.artist]),
    ];
    return [...new Set(candidates)].filter((item) => item.toLocaleLowerCase().includes(value) && item.toLocaleLowerCase() !== value).slice(0, 7);
  }, [archiveTracks, input, localTracks, recent, syncedTracks, youtubeSearch.data?.pages]);
  const chooseSuggestion = (value: string) => { setInput(value); setQuery(value); setSuggestionIndex(-1); setInputFocused(false); };
  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setSuggestionIndex(-1); event.currentTarget.blur(); return; }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setSuggestionIndex((current) => (current + 1) % suggestions.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setSuggestionIndex((current) => current <= 0 ? suggestions.length - 1 : current - 1); }
    if (event.key === "Enter" && suggestionIndex >= 0) { event.preventDefault(); chooseSuggestion(suggestions[suggestionIndex]); }
  };

  return (
    <div className="page-stack search-page">
      <section className="search-hero"><span className="eyebrow"><Search size={14} /> YouTube-first music search</span><h1>Find music to stream.</h1><div className="search-box-wrap"><label><Search size={21} /><span className="sr-only">Search by track, artist, album, or mood</span><input aria-label="Search by track, artist, album, or mood" autoFocus value={input} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onChange={(event) => { setInput(event.target.value); setInputFocused(true); setSuggestionIndex(-1); }} onKeyDown={onInputKeyDown} placeholder="Track, artist, album, or mood…" role="combobox" aria-autocomplete="list" aria-expanded={inputFocused && suggestions.length > 0} aria-controls="search-suggestions" aria-activedescendant={suggestionIndex >= 0 ? `suggestion-${suggestionIndex}` : undefined} /><kbd>ESC</kbd></label>{inputFocused && suggestions.length > 0 && <div className="search-suggestions" id="search-suggestions" role="listbox">{suggestions.map((suggestion, index) => <button id={`suggestion-${index}`} role="option" aria-selected={suggestionIndex === index} className={suggestionIndex === index ? "active" : ""} key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}><History size={14} /> {suggestion}</button>)}</div>}</div><div className="category-chips" role="group" aria-label="Search source">{(["all", "youtube", "archive", "library"] as const).map((source) => <button key={source} className={sourceFilter === source ? "active" : ""} aria-pressed={sourceFilter === source} onClick={() => setSourceFilter(source)}>{source === "all" ? "All sources" : source === "archive" ? "Internet Archive" : source === "library" ? "Your library" : "YouTube"}</button>)}</div></section>
      {!online && <div className="provider-notice status-notice"><WifiOff /> You are offline. Local library matches remain available.</div>}
      {(youtubeSearch.isFetching || (onlineSearch.isFetching && !onlineSearch.isFetchingNextPage)) && results.length === 0 && <TrackListSkeleton label="Searching YouTube and open music" />}
      {query.length < 2 ? <div className="empty-state"><Search size={30} /><h3>Search online music</h3><p>Search YouTube for broad song coverage and the Internet Archive for downloadable Creative Commons and public-domain MP3 audio. Local files are included when they match.</p>{recent.length > 0 && <div className="recent-searches">{recent.map((value) => <button key={value} onClick={() => chooseSuggestion(value)}>{value}</button>)}</div>}</div>
        : <section><div className="section-heading"><div><span className="eyebrow"><Music2 size={14} /> {sourceFilter === "all" ? "YouTube first" : `${sourceFilter} results`}</span><h2>Music in {APP_NAME}</h2><p>YouTube results preserve provider relevance; other sources follow in clearly identified groups.</p></div><span className="result-count">{results.length}</span></div>{youtubeSearch.isError && <div className="provider-notice source-error"><span>{youtubeSearch.error.message}</span><Button variant="secondary" size="sm" onClick={() => youtubeSearch.refetch()}><RefreshCw size={14} /> Retry YouTube</Button></div>}{onlineSearch.isError && <div className="provider-notice source-error"><span>{onlineSearch.error.message}</span><Button variant="secondary" size="sm" onClick={() => onlineSearch.refetch()}><RefreshCw size={14} /> Retry Archive</Button></div>}{results.length ? <div className="track-list">{results.map((track, index) => <TrackRow key={track.id} track={track} context={results} index={index} />)}</div> : !onlineSearch.isFetching && !youtubeSearch.isFetching && <div className="empty-state compact"><p>No music matches found in this source.</p></div>}<div className="load-more">{sourceFilter !== "archive" && sourceFilter !== "library" && youtubeSearch.hasNextPage && <Button variant="secondary" onClick={() => youtubeSearch.fetchNextPage()} disabled={youtubeSearch.isFetchingNextPage}>{youtubeSearch.isFetchingNextPage ? <Skeleton className="skeleton-inline" /> : null} More YouTube results</Button>}{sourceFilter !== "youtube" && sourceFilter !== "library" && onlineSearch.hasNextPage && <Button variant="secondary" onClick={() => onlineSearch.fetchNextPage()} disabled={onlineSearch.isFetchingNextPage}>{onlineSearch.isFetchingNextPage ? <Skeleton className="skeleton-inline" /> : null} More open music</Button>}</div></section>}
    </div>
  );
}
