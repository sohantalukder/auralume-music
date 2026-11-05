"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Compass, Heart, History, Home, Library, ListMusic, Settings, SunMoon, User } from "lucide-react";
import { useTheme } from "next-themes";
import { signIn, useSession } from "next-auth/react";
import { BottomPlayer } from "@/components/player/bottom-player";
import { GlobalSearch } from "@/components/global-search";
import { APP_NAME } from "@/lib/brand";

const navigation = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/library", label: "Your library", icon: Library },
  { href: "/liked", label: "Liked songs", icon: Heart },
  { href: "/recent", label: "Recently played", icon: History },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
];

export function Logo() {
  return <Link href="/home" className="logo" aria-label={`${APP_NAME} home`}><span className="logo-mark"><i /><i /><i /></span><strong>{APP_NAME}</strong></Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Logo />
        <nav className="side-nav" aria-label="Primary navigation">
          {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={19} /><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-spacer" />
        <nav className="side-nav secondary" aria-label="Account navigation">
          <Link href="/settings" className={pathname === "/settings" ? "active" : ""}><Settings size={19} /><span>Settings</span></Link>
          <Link href="/profile" className={pathname === "/profile" ? "active" : ""}><User size={19} /><span>Profile</span></Link>
        </nav>
      </aside>
      <div className="app-column">
        <header className="topbar">
          <div className="history-buttons"><button onClick={() => router.back()} aria-label="Go back"><ChevronLeft /></button><button onClick={() => router.forward()} aria-label="Go forward"><ChevronRight /></button></div>
          <div className="mobile-logo"><Logo /></div>
          <GlobalSearch />
          <button className="theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme"><SunMoon size={18} /></button>
          {session?.user ? <Link href="/profile" className="avatar-button">{session.user.image ? <img src={session.user.image} alt="" referrerPolicy="no-referrer" /> : <User size={17} />}<span>{session.user.name || "Profile"}</span></Link> : <button className="sign-in-link" disabled={status === "loading"} onClick={() => signIn("google", { callbackUrl: "/profile" })}><User size={17} /><span>Sign in with Google</span></button>}
        </header>
        <main className="app-main">{children}</main>
        <footer className="app-footer"><span>Crafted for focused listening.</span><a href="https://sohantalukder.github.io" target="_blank" rel="me noreferrer">Developed by Sohan Talukder <span aria-hidden="true">↗</span></a></footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={21} /><span>{label.replace("Your ", "")}</span></Link>)}
      </nav>
      {pathname !== "/player" && <BottomPlayer />}
    </div>
  );
}
