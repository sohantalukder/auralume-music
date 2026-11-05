"use client";

import { useQuery } from "@tanstack/react-query";
import { History, Music2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { emptyPersonalizationProfile, loadPersonalizationProfile, rankTracks, recordSearchEvent } from "@/lib/personalization";
import { fetchArchiveSearch, fetchYouTubeSearch, mergeSearchSources } from "@/lib/search-client";
import type { PersonalizationProfile, Track } from "@/lib/types";
import { usePlayerStore } from "@/stores/player-store";
import { SearchMenuSkeleton } from "@/components/ui/skeleton";

type RecentSearch = { query: string; artwork?: string };

export function GlobalSearch() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordedKey = useRef("");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [profile, setProfile] = useState<PersonalizationProfile>(emptyPersonalizationProfile);
  const localTracks = usePlayerStore((state) => state.localTracks);
  const syncedTracks = usePlayerStore((state) => state.syncedTracks);
  const play = usePlayerStore((state) => state.play);

  useEffect(() => { void loadPersonalizationProfile().then(setProfile); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const onOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onShortcut);
    document.addEventListener("pointerdown", onOutsideClick);
    return () => {
      window.removeEventListener("keydown", onShortcut);
      document.removeEventListener("pointerdown", onOutsideClick);
    };
  }, [open]);

  const archiveSearch = useQuery({
    queryKey: ["global-archive-search", query],
    queryFn: ({ signal }) => fetchArchiveSearch(query, 1, signal),
    enabled: open && query.length >= 2,
  });
  const youtubeSearch = useQuery({
    queryKey: ["global-youtube-search", query],
    queryFn: ({ signal }) => fetchYouTubeSearch(query, signal),
    enabled: open && query.length >= 2,
  });
  const results = useMemo(() => {
    if (query.length < 2) return [];
    const value = query.toLocaleLowerCase();
    const browserMatches = [...localTracks, ...syncedTracks].filter((track) => `${track.title} ${track.artist} ${track.album || ""}`.toLocaleLowerCase().includes(value));
    const tracks = mergeSearchSources(youtubeSearch.data ?? [], rankTracks(archiveSearch.data?.data ?? [], profile, query), rankTracks(browserMatches, profile, query));
    return tracks.slice(0, 12);
  }, [archiveSearch.data?.data, localTracks, profile, query, syncedTracks, youtubeSearch.data]);
  const recentSearches = useMemo(() => {
    const seen = new Set<string>();
    return profile.searches.reduce<RecentSearch[]>((items, search) => {
      const key = search.query.toLocaleLowerCase();
      if (seen.has(key)) return items;
      seen.add(key);
      items.push({ query: search.query, artwork: search.tracks?.[0]?.artwork });
      return items;
    }, []).slice(0, 12);
  }, [profile.searches]);
  const showingRecent = query.length < 2;
  const optionCount = showingRecent ? recentSearches.length : results.length;

  useEffect(() => {
    if (query.length < 2 || !archiveSearch.isFetched || !youtubeSearch.isFetched) return;
    const key = query.toLocaleLowerCase();
    if (recordedKey.current === key) return;
    recordedKey.current = key;
    void recordSearchEvent(query, undefined, results)
      .then(() => loadPersonalizationProfile().then(setProfile))
      .catch(() => undefined);
  }, [archiveSearch.isFetched, query, results, youtubeSearch.isFetched]);

  const chooseRecent = (recent: RecentSearch) => {
    setInput(recent.query);
    setQuery(recent.query);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };
  const chooseTrack = (track: Track) => {
    play(track, results);
    setOpen(false);
    setActiveIndex(-1);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !optionCount) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % optionCount);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? optionCount - 1 : current - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      if (showingRecent) chooseRecent(recentSearches[activeIndex]);
      else chooseTrack(results[activeIndex]);
    }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setOpen(true);
  };
  const clear = () => {
    setInput("");
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="global-search-wrap" ref={containerRef}>
      <form className={open ? "global-search active" : "global-search"} role="search" onSubmit={submit}>
        <Search size={19} aria-hidden="true" />
        <input ref={inputRef} value={input} onFocus={() => setOpen(true)} onChange={(event) => { setInput(event.target.value); setActiveIndex(-1); }} onKeyDown={onKeyDown} placeholder="Search music" aria-label="Search music" role="combobox" aria-expanded={open} aria-controls="global-search-results" aria-activedescendant={activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined} autoComplete="off" />
        {input ? <button type="button" className="search-clear" onClick={clear} aria-label="Clear search"><X size={17} /></button> : <kbd>⌘ K</kbd>}
        <button type="submit" className="search-submit" aria-label="Search"><Search size={20} /></button>
      </form>
      {open && <div className="global-search-menu" id="global-search-results" role="listbox" aria-label={showingRecent ? "Recent searches" : "Search results"}>
        {showingRecent ? recentSearches.length > 0 ? recentSearches.map((recent, index) => <button type="button" id={`global-search-option-${index}`} role="option" aria-selected={activeIndex === index} className={activeIndex === index ? "active" : ""} key={recent.query} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseRecent(recent)}><History /><span><strong>{recent.query}</strong><small>Recent search</small></span>{recent.artwork ? <img src={recent.artwork} width={76} height={44} alt="" /> : <span className="search-art-placeholder"><Music2 /></span>}</button>) : <div className="global-search-empty"><History /><span>Your recent searches will appear here.</span></div>
          : archiveSearch.isFetching || youtubeSearch.isFetching ? <SearchMenuSkeleton />
            : results.length > 0 ? results.map((track, index) => <button type="button" id={`global-search-option-${index}`} role="option" aria-selected={activeIndex === index} className={activeIndex === index ? "active" : ""} key={track.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTrack(track)}><Music2 /><span><strong>{track.title}</strong><small>{track.artist} · {track.source === "youtube" ? "YouTube" : track.source === "archive" ? "Internet Archive" : "Your library"}</small></span><img src={track.artwork || "/artwork/local.svg"} width={76} height={44} alt="" /></button>) : <div className="global-search-empty"><Search /><span>No matching music found.</span></div>}
      </div>}
    </div>
  );
}
