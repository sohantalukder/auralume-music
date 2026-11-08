import { Headphones } from "lucide-react";
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
      <div className="landing-glow" aria-hidden="true" />
      <nav className="landing-nav"><Logo /><Link href="/home" className="nav-connect">Open app</Link></nav>
      <section className="landing-hero">
        <div className="landing-disc" aria-hidden="true"><span /><i /><b><i /><i /><i /><i /><i /></b></div>
        <h1>Your music,<br /><em>beautifully simple.</em></h1>
        <p>Search any song, play it anywhere, keep it playing when your screen locks.</p>
        <Link href="/home" className="primary-cta"><Headphones size={18} /> Start listening</Link>
      </section>
      <footer><span>© {APP_NAME}</span><Link href="/privacy">Privacy</Link><a href="https://sohantalukder.github.io" target="_blank" rel="me noreferrer">Sohan Talukder ↗</a></footer>
    </main>
  );
}
