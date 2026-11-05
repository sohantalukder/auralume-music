import { ArrowRight, Headphones, Library, Play, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/app-shell";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";

export default function LandingPage() {
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: APP_NAME,
    description: APP_DESCRIPTION,
    url: siteUrl.toString(),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  return (
    <main className="landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="landing-nav"><Logo /><div><Link href="/privacy">Privacy</Link><Link href="/home" className="nav-connect">Open {APP_NAME}</Link></div></nav>
      <section className="landing-hero">
        <div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" />
        <div className="hero-pill"><Sparkles size={14} /> Online music, audio only</div>
        <h1>Press play.<br /><em>Keep it simple.</em></h1>
        <p>Stream online music with native {APP_NAME} controls, or sign in with Google to bring your YouTube playlists. No video, subscription, or hosted profile database.</p>
        <div className="landing-actions"><Link href="/home" className="primary-cta"><Headphones size={18} /> Start listening</Link><Link href="/library" className="secondary-cta">Add local music <ArrowRight size={17} /></Link></div>
        <div className="hero-player-preview"><div className="preview-art"><span /><i /></div><div><small>ONLINE AUDIO</small><strong>Internet Archive</strong><span>Optional device files</span></div><Link href="/home" aria-label="Open online music"><Play fill="currentColor" /></Link></div>
      </section>
      <section className="landing-features">
        <article><span><Headphones /></span><h2>Online listening</h2><p>Search and stream Creative Commons and public-domain MP3 audio through {APP_NAME}’s native audio engine.</p></article>
        <article><span><Library /></span><h2>Optional local library</h2><p>Add compatible audio from your device when you want; its bytes stay in browser IndexedDB.</p></article>
        <article><span><SlidersHorizontal /></span><h2>Complete controls</h2><p>Seek, queue, shuffle, repeat, like, and open lyrics without leaving the player.</p></article>
      </section>
      <section className="trust-strip"><ShieldCheck /><p><strong>No video. No server uploads.</strong> Online audio plus an optional private device library.</p><Link href="/privacy">How it works <ArrowRight size={15} /></Link></section>
      <footer><Logo /><a href="https://sohantalukder.github.io" target="_blank" rel="me noreferrer">Developed by Sohan Talukder ↗</a></footer>
    </main>
  );
}
