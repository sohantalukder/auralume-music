import type { Track } from "@/lib/types";

const DB_NAME = "aura-local-audio";
const STORE_NAME = "tracks";
const DB_VERSION = 1;
const SUPPORTED_MIME_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg"]);
const SUPPORTED_EXTENSIONS = /\.(mp3|m4a|aac|wav|ogg)$/i;

type StoredAudio = {
  id: string;
  title: string;
  artist: string;
  mime: string;
  blob: Blob;
  addedAt: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = operation(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function toTrack(audio: StoredAudio): Track {
  return {
    id: `local:${audio.id}`,
    providerTrackId: audio.id,
    source: "local",
    title: audio.title,
    artist: audio.artist,
    album: "On this device",
    genres: ["Local"],
    playable: true,
    streamUrl: URL.createObjectURL(audio.blob),
    license: { name: "User-owned local file" },
  };
}

export async function saveLocalAudio(file: File): Promise<Track> {
  if (!SUPPORTED_MIME_TYPES.has(file.type.toLocaleLowerCase()) && !SUPPORTED_EXTENSIONS.test(file.name)) {
    throw new Error("Choose an MP3, AAC, WAV, or OGG file.");
  }
  if (file.size > 50 * 1024 * 1024) throw new Error("Local files must be 50 MB or smaller.");
  const base = file.name.replace(/\.[^.]+$/, "").trim() || "Untitled";
  const id = crypto.randomUUID();
  const stored: StoredAudio = {
    id,
    title: base,
    artist: "Local file",
    mime: file.type,
    blob: file,
    addedAt: new Date().toISOString(),
  };
  await transaction("readwrite", (store) => store.put(stored));
  return toTrack(stored);
}

export async function listLocalAudio(): Promise<Track[]> {
  const rows = await transaction<StoredAudio[]>("readonly", (store) => store.getAll());
  return rows.map(toTrack);
}

export async function deleteLocalAudio(id: string) {
  await transaction("readwrite", (store) => store.delete(id.replace(/^local:/, "")));
}

export async function clearLocalAudio() {
  await transaction("readwrite", (store) => store.clear());
}
