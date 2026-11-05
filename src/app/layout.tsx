import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { APP_DESCRIPTION, APP_NAME, APP_TITLE } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: APP_TITLE, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "Sohan Talukder", url: "https://sohantalukder.github.io" }],
  creator: "Sohan Talukder",
  publisher: APP_NAME,
  category: "music",
  keywords: ["music player", "audio player", "YouTube music search", "Internet Archive music", "local music player", "equalizer"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
};

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0d09" }, { media: "(prefers-color-scheme: light)", color: "#f4f6ef" }], width: "device-width", initialScale: 1 };

const chunkRecoveryScript = `(()=>{const key="aura:chunk-reload";const recover=value=>{const message=String(value?.message||value||"");if(!/ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(message))return;try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,location.href)}catch{}location.reload()};addEventListener("error",event=>recover(event.error||event.message));addEventListener("unhandledrejection",event=>recover(event.reason))})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><body><Script id="chunk-recovery" strategy="beforeInteractive">{chunkRecoveryScript}</Script><Providers>{children}<PwaRegister /></Providers></body></html>;
}
