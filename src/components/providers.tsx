"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { PlayerEngineProvider } from "@/components/player/player-engine";
import { listLocalAudio } from "@/lib/local-audio";
import { usePlayerStore } from "@/stores/player-store";
import { CustomizationController } from "@/components/customization-controller";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));
  const setLocalTracks = usePlayerStore((state) => state.setLocalTracks);
  useEffect(() => { void listLocalAudio().then(setLocalTracks).catch(() => undefined); }, [setLocalTracks]);
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <CustomizationController />
        <QueryClientProvider client={queryClient}>
          <PlayerEngineProvider>{children}</PlayerEngineProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
