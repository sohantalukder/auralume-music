"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shared fallback for route error boundaries; the audio engine lives above these boundaries, so playback continues. */
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;
  return (
    <div className="empty-state tall" role="alert">
      <TriangleAlert />
      <h2>Something went wrong</h2>
      <p>This screen hit an unexpected error. Your music keeps playing.{digest ? ` Reference: ${digest}` : ""}</p>
      <div className="collection-actions">
        <Button onClick={retry}><RefreshCw size={16} /> Try again</Button>
        <Link href="/home" className="action-chip">Go home</Link>
      </div>
    </div>
  );
}
