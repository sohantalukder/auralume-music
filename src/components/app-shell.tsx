"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Compass, Heart, History, Home, Library, ListMusic, ChevronsLeft, ChevronsRight, Search, Settings, SunMoon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { BottomPlayer } from "@/components/player/bottom-player";
import { GlobalSearch } from "@/components/global-search";
import { APP_NAME } from "@/lib/brand";
import { usePlayerStore } from "@/stores/player-store";

type NavItem = { href: string; label: string; icon: typeof Home };

// Grouped like the Apple Music sidebar: a browse section, then the personal library.
const browseNavigation: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
];
const libraryNavigation: NavItem[] = [
  { href: "/library", label: "Your library", icon: Library },
  { href: "/liked", label: "Liked songs", icon: Heart },
  { href: "/recent", label: "Recently played", icon: History },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
];
// iOS tab bar: five destinations, with search always one tap away.
const tabNavigation: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Collapsed state is a per-browser preference; open by default (and on the server).
const SIDEBAR_KEY = "aura-sidebar-collapsed";
const sidebarListeners = new Set<() => void>();
function readSidebarCollapsed() {
  try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
}
function setSidebarCollapsed(collapsed: boolean) {
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0"); } catch { /* storage unavailable: keep the in-page toggle working */ }
  sidebarListeners.forEach((listener) => listener());
}
function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => { sidebarListeners.delete(listener); };
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  // title/aria-label keep icon-only links usable when the sidebar is collapsed.
  return <>{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined} aria-label={label} title={label}><Icon size={18} /><span>{label}</span></Link>)}</>;
}

export function Logo() {
  return <Link href="/home" className="logo" aria-label={`${APP_NAME} home`}><span className="logo-mark"><i /><i /><i /></span><strong>{APP_NAME}</strong></Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchPage = pathname === "/search";
  const playerPage = pathname === "/player";
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const sidebarCollapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);

  useEffect(() => {
    // ⌘\ / Ctrl+\ toggles the sidebar, matching the Mac sidebar shortcut.
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        setSidebarCollapsed(!readSidebarCollapsed());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hasTrack = usePlayerStore((state) => state.currentIndex >= 0 && state.currentIndex < state.queue.length);
  return (
    <div className="app-frame" data-sidebar={sidebarCollapsed ? "collapsed" : "open"}>
      <AmbientBackdrop intensity={playerPage ? "full" : "soft"} />
      <aside className="sidebar">
        <div className="sidebar-header">
          <Logo />
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar (⌘\\)`}>{sidebarCollapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}</button>
        </div>
        <nav className="side-nav" aria-label="Browse">
          <NavList items={browseNavigation} pathname={pathname} />
        </nav>
        <nav className="side-nav" aria-labelledby="sidebar-library">
          <p className="side-heading" id="sidebar-library">Library</p>
          <NavList items={libraryNavigation} pathname={pathname} />
        </nav>
        <div className="sidebar-spacer" />
        <nav className="side-nav secondary" aria-label="Account">
          <NavList items={[{ href: "/settings", label: "Settings", icon: Settings }]} pathname={pathname} />
        </nav>
      </aside>
      <div className="app-column">
        <header className={searchPage ? "topbar search-route" : "topbar"}>
          <div className="history-buttons"><button onClick={() => router.back()} aria-label="Go back"><ChevronLeft /></button><button onClick={() => router.forward()} aria-label="Go forward"><ChevronRight /></button></div>
          <div className="mobile-logo"><Logo /></div>
          {searchPage ? <div className="topbar-spacer" /> : <GlobalSearch />}
          <button className="theme-button topbar-end" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme"><SunMoon size={18} /></button>
        </header>
        <main className="app-main">
          {/* Enter-only: the App Router swaps pages immediately, so exit animations would not run reliably. */}
          <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, ease: "easeOut" }}>{children}</motion.div>
        </main>
        <footer className="app-footer"><span>Crafted for focused listening.</span><a href="https://sohantalukder.github.io" target="_blank" rel="me noreferrer">Developed by Sohan Talukder <span aria-hidden="true">↗</span></a></footer>
      </div>
      <nav className="mobile-nav" aria-label="Tabs">
        {tabNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}><Icon size={22} /><span>{label}</span></Link>)}
      </nav>
      <AnimatePresence>{!playerPage && hasTrack && <BottomPlayer key="mini-player" />}</AnimatePresence>
    </div>
  );
}
