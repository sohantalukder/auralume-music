import { ListMusic } from "lucide-react";
import type { Track } from "@/lib/types";

/** Apple Music-style cover: a 2×2 artwork collage, one artwork, or a tinted placeholder. */
export function PlaylistCover({ tracks, className = "" }: { tracks: Track[]; className?: string }) {
  const art = [...new Set(tracks.map((track) => track.artwork).filter((src): src is string => Boolean(src)))].slice(0, 4);
  if (art.length >= 4) return <span className={`playlist-cover collage ${className}`}>{art.map((src) => <img key={src} src={src} alt="" />)}</span>;
  if (art.length) return <span className={`playlist-cover ${className}`}><img src={art[0]} alt="" /></span>;
  return <span className={`playlist-cover empty ${className}`}><ListMusic /></span>;
}
