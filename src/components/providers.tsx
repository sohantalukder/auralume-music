"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { PlayerEngineProvider } from "@/components/player/player-engine";
import { listLocalAudio } from "@/lib/local-audio";
import { usePlayerStore } from "@/stores/player-store";
import { CustomizationController } from "@/components/customization-controller";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));
  const setLocalTracks = usePlayerStore((state) => state.setLocalTracks);
  useEffect(() => { void usePlayerStore.persist.rehydrate(); }, []);
  useEffect(() => { void listLocalAudio().then(setLocalTracks).catch(() => setLocalTracks([])); }, [setLocalTracks]);
  return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <CustomizationController />
        <QueryClientProvider client={queryClient}>
          {/* Honour the OS reduced-motion setting for every motion component. */}
          <MotionConfig reducedMotion="user">
            <PlayerEngineProvider>{children}</PlayerEngineProvider>
          </MotionConfig>
        </QueryClientProvider>
      </ThemeProvider>
  );
}
