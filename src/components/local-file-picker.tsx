"use client";

import { FileAudio, ShieldCheck, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteLocalAudio, saveLocalAudio } from "@/lib/local-audio";
import { usePlayerStore } from "@/stores/player-store";
import { TrackRow } from "@/components/track-row";
import { APP_NAME } from "@/lib/brand";

export function LocalFilePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const localTracks = usePlayerStore((state) => state.localTracks);
  const addLocalTrack = usePlayerStore((state) => state.addLocalTrack);
  const removeLocalTrack = usePlayerStore((state) => state.removeLocalTrack);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMessage(undefined);
    for (const file of Array.from(files)) {
      try { addLocalTrack(await saveLocalAudio(file)); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Could not open this file."); }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (id: string) => {
    try { await deleteLocalAudio(id); removeLocalTrack(id); }
    catch { setMessage("Could not remove this file from browser storage."); }
  };

  return (
    <section className="local-section">
      <div className="local-callout">
        <div className="local-icon"><FileAudio size={24} /></div>
        <div><h3>Music on this device</h3><p><ShieldCheck size={14} /> Files stay in this browser. {APP_NAME} never uploads them.</p></div>
        <input ref={inputRef} className="sr-only" type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg" multiple onChange={(event) => pickFiles(event.target.files)} />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? <Skeleton className="skeleton-inline" /> : <FileAudio size={17} />} {busy ? "Opening files…" : "Open local files"}</Button>
      </div>
      {message && <p className="form-message">{message}</p>}
      {localTracks.length > 0 && <div className="track-list">{localTracks.map((track, index) => <div key={track.id} className="local-track-wrap"><TrackRow track={track} context={localTracks} index={index} /><button className="icon-button local-delete" onClick={() => remove(track.id)} aria-label={`Remove ${track.title} from this device`}><Trash2 size={17} /></button></div>)}</div>}
    </section>
  );
}
