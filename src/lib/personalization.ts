import type {
  CategoryAffinity,
  ListeningPreferences,
  PersonalizationProfile,
  RecommendationSignal,
  RecommendationSignalKind,
  SearchEvent,
  Track,
} from "@/lib/types";

const DB_NAME = "aura-personalization";
const DB_VERSION = 1;
const SEARCH_STORE = "searchEvents";
const SIGNAL_STORE = "recommendationSignals";
const CATEGORY_STORE = "categoryAffinities";
const MAX_SEARCHES = 80;
const MAX_SIGNALS = 500;
const DAY = 86_400_000;
const PERSONALIZATION_CHANGE_EVENT = "aura:personalization-change";

type PersonalizationChangeKind = "search" | "signal" | "clear";

export const emptyPersonalizationProfile: PersonalizationProfile = { searches: [], categories: [], signals: [] };
const emptyListeningPreferences: ListeningPreferences = { artists: [], genres: [], languages: [] };

function notifyPersonalizationChanged(kind: PersonalizationChangeKind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PERSONALIZATION_CHANGE_EVENT, { detail: kind }));
}

export function subscribeToPersonalizationChanges(listener: (kind: PersonalizationChangeKind) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<PersonalizationChangeKind>).detail);
  window.addEventListener(PERSONALIZATION_CHANGE_EVENT, handler);
  return () => window.removeEventListener(PERSONALIZATION_CHANGE_EVENT, handler);
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SEARCH_STORE)) db.createObjectStore(SEARCH_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SIGNAL_STORE)) db.createObjectStore(SIGNAL_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CATEGORY_STORE)) db.createObjectStore(CATEGORY_STORE, { keyPath: "category" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function normalizedCategory(value: string) {
  return value.trim().toLocaleLowerCase().slice(0, 48);
}

async function prune(storeName: string, maximum: number) {
  const rows = await withStore<Array<{ id: string; createdAt: string }>>(storeName, "readonly", (store) => store.getAll());
  if (rows.length <= maximum) return;
  const expired = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(maximum);
  await Promise.all(expired.map((row) => withStore(storeName, "readwrite", (store) => store.delete(row.id))));
}

async function addAffinity(categories: string[], amount: number) {
  await Promise.all(categories.map(async (rawCategory) => {
    const category = normalizedCategory(rawCategory);
    if (!category) return;
    const current = await withStore<CategoryAffinity | undefined>(CATEGORY_STORE, "readonly", (store) => store.get(category));
    const elapsedDays = current ? Math.max(0, (Date.now() - Date.parse(current.updatedAt)) / DAY) : 0;
    const decayed = (current?.score ?? 0) * Math.pow(0.92, elapsedDays);
    const next: CategoryAffinity = { category, score: Math.max(-20, Math.min(40, decayed + amount)), updatedAt: new Date().toISOString() };
    await withStore(CATEGORY_STORE, "readwrite", (store) => store.put(next));
  }));
}

export async function recordSearchEvent(query: string, category: string | undefined, results: Track[]) {
  const cleanQuery = query.trim().slice(0, 80);
  if (cleanQuery.length < 2) return;
  const tracks = results.filter((track) => track.source !== "local").slice(0, 24);
  const event: SearchEvent = { id: makeId(), query: cleanQuery, category: category || undefined, resultIds: tracks.map((track) => track.id), tracks, createdAt: new Date().toISOString() };
  await withStore(SEARCH_STORE, "readwrite", (store) => store.put(event));
  await addAffinity([category || cleanQuery], 2.5);
  await prune(SEARCH_STORE, MAX_SEARCHES);
  notifyPersonalizationChanged("search");
}

const signalWeights: Record<RecommendationSignalKind, number> = {
  play: 0.8,
  complete: 3,
  skip: -2.5,
  like: 5,
  unlike: -4,
  impression: -0.08,
};

export async function recordRecommendationSignal(kind: RecommendationSignalKind, track: Track) {
  const signal: RecommendationSignal = {
    id: makeId(),
    kind,
    trackId: track.id,
    categories: track.genres.map(normalizedCategory).filter(Boolean),
    createdAt: new Date().toISOString(),
  };
  await withStore(SIGNAL_STORE, "readwrite", (store) => store.put(signal));
  await addAffinity(signal.categories, signalWeights[kind]);
  await prune(SIGNAL_STORE, MAX_SIGNALS);
  if (kind !== "impression") notifyPersonalizationChanged("signal");
}

export async function loadPersonalizationProfile(): Promise<PersonalizationProfile> {
  try {
    const [searches, categories, signals] = await Promise.all([
      withStore<SearchEvent[]>(SEARCH_STORE, "readonly", (store) => store.getAll()),
      withStore<CategoryAffinity[]>(CATEGORY_STORE, "readonly", (store) => store.getAll()),
      withStore<RecommendationSignal[]>(SIGNAL_STORE, "readonly", (store) => store.getAll()),
    ]);
    return {
      searches: searches.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      categories: categories.sort((a, b) => b.score - a.score),
      signals: signals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch {
    return emptyPersonalizationProfile;
  }
}

export async function clearPersonalization() {
  if (typeof indexedDB === "undefined") return;
  await Promise.all([SEARCH_STORE, SIGNAL_STORE, CATEGORY_STORE].map((name) => withStore(name, "readwrite", (store) => store.clear())));
  notifyPersonalizationChanged("clear");
}

function ageWeight(createdAt: string, halfLifeDays = 28) {
  const age = Math.max(0, Date.now() - Date.parse(createdAt));
  return Math.pow(0.5, age / (halfLifeDays * DAY));
}

function textScore(track: Track, query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return 0;
  const title = track.title.toLocaleLowerCase();
  const artist = track.artist.toLocaleLowerCase();
  const album = track.album?.toLocaleLowerCase() ?? "";
  const genres = track.genres.map(normalizedCategory);
  let score = 0;
  if (title === q) score += 60;
  else if (title.startsWith(q)) score += 36;
  else if (title.includes(q)) score += 24;
  if (artist === q) score += 40;
  else if (artist.startsWith(q)) score += 24;
  else if (artist.includes(q)) score += 16;
  if (album.includes(q)) score += 8;
  if (genres.some((genre) => genre === q)) score += 20;
  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (`${title} ${artist} ${album} ${genres.join(" ")}`.includes(token)) score += 3;
  }
  return score;
}

export function scoreTrack(track: Track, profile: PersonalizationProfile, query = "", preferences: ListeningPreferences = emptyListeningPreferences) {
  const categoryScore = track.genres.reduce((total, genre) => {
    const affinity = profile.categories.find((item) => item.category === normalizedCategory(genre));
    return total + (affinity?.score ?? 0);
  }, 0);
  const signalScore = profile.signals.reduce((total, signal) => {
    if (signal.trackId !== track.id) return total;
    return total + signalWeights[signal.kind] * ageWeight(signal.createdAt, signal.kind === "impression" ? 7 : 45);
  }, 0);
  const searchScore = profile.searches.reduce((total, search) => {
    const match = textScore(track, search.query);
    const appearedInResults = search.resultIds.includes(track.id) ? 18 : 0;
    return total + (Math.min(12, match * 0.2) + appearedInResults) * ageWeight(search.createdAt, 21);
  }, 0);
  const freshness = track.createdAt ? Math.max(0, 4 - (Date.now() - Date.parse(track.createdAt)) / (30 * DAY)) : 0;
  const popularity = Math.log10(Math.max(1, track.popularity ?? 1));
  const normalizedArtist = track.artist.toLocaleLowerCase();
  const preferenceScore = preferences.artists.reduce((total, artist) => total + (normalizedArtist.includes(normalizedCategory(artist)) ? 18 : 0), 0)
    + preferences.genres.reduce((total, genre) => total + (track.genres.some((item) => normalizedCategory(item) === normalizedCategory(genre)) ? 12 : 0), 0)
    + preferences.languages.reduce((total, language) => total + (`${track.title} ${track.album ?? ""}`.toLocaleLowerCase().includes(normalizedCategory(language)) ? 5 : 0), 0);
  return textScore(track, query) + categoryScore * 1.4 + signalScore + searchScore + preferenceScore + freshness + popularity + (track.playable ? 2 : -20);
}

export function rankTracks(tracks: Track[], profile: PersonalizationProfile, query = "", preferences: ListeningPreferences = emptyListeningPreferences) {
  return [...tracks].sort((a, b) => {
    const difference = scoreTrack(b, profile, query, preferences) - scoreTrack(a, profile, query, preferences);
    return difference || a.title.localeCompare(b.title);
  });
}

export function recommendTracks(tracks: Track[], profile: PersonalizationProfile, limit = 8, preferences: ListeningPreferences = emptyListeningPreferences) {
  const ranked = rankTracks(tracks, profile, "", preferences);
  const selected: Track[] = [];
  const genreCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  for (const track of ranked) {
    const primary = normalizedCategory(track.genres[0] || track.source);
    const artist = normalizedCategory(track.artist);
    if (((genreCounts.get(primary) ?? 0) >= 2 || ((artistCounts.get(artist) ?? 0) >= 2 && (genreCounts.get(primary) ?? 0) >= 1)) && selected.length < Math.ceil(limit * 0.75)) continue;
    selected.push(track);
    genreCounts.set(primary, (genreCounts.get(primary) ?? 0) + 1);
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    if (selected.length === limit) break;
  }
  for (const track of ranked) {
    if (selected.length === limit) break;
    if (!selected.some((item) => item.id === track.id)) selected.push(track);
  }
  return selected;
}
