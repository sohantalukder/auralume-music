"use client";

import { RouteError } from "@/components/route-error";

export default function MusicError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}
