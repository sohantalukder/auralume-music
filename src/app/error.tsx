"use client";

import { RouteError } from "@/components/route-error";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <main className="not-found"><RouteError error={error} retry={retry} /></main>;
}
