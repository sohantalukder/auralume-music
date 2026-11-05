import { Suspense } from "react";
import { DashboardScreen } from "@/components/screens/dashboard-screen";
import { SearchScreen } from "@/components/screens/search-screen";
import { LibraryScreen, LikedScreen, PlaylistsScreen, RecentScreen } from "@/components/screens/library-screen";
import { PrivacyScreen, ProfileScreen, QueueScreen } from "@/components/screens/utility-screens";
import { SettingsScreen } from "@/components/screens/settings-screen";
import { FullPlayerScreen } from "@/components/player/full-player";
import { PageSkeleton } from "@/components/ui/skeleton";

export function ScreenRouter({ view }: { view: string }) {
  switch (view) {
    case "home": return <DashboardScreen />;
    case "discover": return <DashboardScreen discover />;
    case "search": return <Suspense fallback={<PageSkeleton />}><SearchScreen /></Suspense>;
    case "library": return <LibraryScreen />;
    case "liked": return <LikedScreen />;
    case "recent": return <RecentScreen />;
    case "playlists": return <PlaylistsScreen />;
    case "queue": return <QueueScreen />;
    case "player": return <FullPlayerScreen />;
    case "settings": return <SettingsScreen />;
    case "profile": return <ProfileScreen />;
    case "privacy": return <PrivacyScreen />;
    default: return <DashboardScreen />;
  }
}
