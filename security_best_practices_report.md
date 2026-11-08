# Auralume security best-practices review

## Executive summary

No critical or high-severity findings were identified. The app has no authentication, database, server-side music upload, arbitrary outbound URL fetcher, or HTML injection sink. Internet Archive requests use fixed hosts, validated identifiers, bounded responses, timeouts, caching, and request throttling. Optional local audio is allowlisted by format, limited to 50 MB, stored in IndexedDB, and rendered only through the browser audio engine. The remaining items are defense-in-depth for a public deployment.

## Critical

No findings.

## High

No findings.

## Medium

No findings.

## Low

### SEC-001 — Add a production Content Security Policy before public deployment

- Rule ID: `NEXT-CSP-001` / `REACT-CSP-001`
- Severity: Low
- Location: `next.config.ts`
- Evidence: Auralume now sends a `Content-Security-Policy-Report-Only` header (self, YouTube/Archive image hosts, Archive media, `frame-ancestors 'none'`). It is not enforced yet and allows `'unsafe-inline'` scripts.
- Impact: If a separate cross-site scripting flaw were introduced later, a CSP would reduce its impact. Current risk is limited because the app has no raw HTML rendering or third-party scripts and uses React text escaping.
- Fix: Before making Auralume public, add a nonce-based production CSP compatible with Next.js and keep `frame-ancestors 'none'`, `object-src 'none'`, and narrowly scoped connect/media/image sources.
- Mitigation: Existing headers, React escaping, fixed upstream hosts, and the absence of dangerous DOM sinks reduce current exposure.
- False-positive notes: A reverse proxy or hosting platform could add CSP outside this repository; verify runtime headers if deployment changes.

### SEC-002 — Server-side evaluation of YouTube scripts in the PoToken fallback

- Severity: Low
- Location: `src/lib/youtube-potoken.ts`, `src/lib/youtube-audio.ts`
- Evidence: The final audio fallback fetches YouTube's attestation interpreter and player decipher code and runs them with `new Function`. Hosts are restricted to `youtube.com`/`google.com` over HTTPS, and the code runs only when unsigned clients fail.
- Impact: Code supplied by YouTube runs inside the server function with access to its environment. jsdom globals are also assigned onto `globalThis`.
- Fix: Run the fallback in an isolated function or worker without secrets in its environment, or remove the fallback if it is not needed.

## Verified controls

- Local files are restricted to MP3/AAC/WAV/OGG-compatible MIME types or extensions and a 50 MB maximum (`src/lib/local-audio.ts:6-7`, `src/lib/local-audio.ts:59-75`).
- Local audio is stored in browser IndexedDB and exposed to playback with blob URLs; there is no server upload endpoint (`src/lib/local-audio.ts:18-41`, `src/lib/local-audio.ts:44-55`).
- Archive search inputs are length-bounded, page-bounded, and safely encoded; outbound requests use the fixed `archive.org` host, eight-second timeouts, request throttling, and bounded cache lifetimes (`src/app/api/archive/route.ts:6-40`).
- Archive identifiers, response sizes, file counts, media format, file size, license host, and license path are allowlisted before a track reaches the player (`src/lib/archive.ts:4-43`, `src/lib/archive.ts:52-105`).
- The lyrics route validates and bounds every query field with Zod, rate-limits callers, uses a fixed upstream host, and applies an eight-second timeout (`src/app/api/lyrics/route.ts:6-30`).
- Lyrics are rendered as escaped React text rather than HTML (`src/components/player/lyrics-panel.tsx:31-39`).
- The service worker excludes API responses from its cache and deletes old cache versions (`public/sw.js:1-8`).
- Repository scans found no `dangerouslySetInnerHTML`, direct HTML injection, dynamic subprocesses, iframes, videos, arbitrary server-side URL fetches, or permissive CORS configuration. The only dynamic evaluation is SEC-002.
- The YouTube audio proxy validates video IDs and ranges, accepts only `googlevideo.com` HTTPS stream hosts, caps each response at 1 MB, and returns generic errors without the signed media URL (`src/app/api/youtube/audio/route.ts`, `src/lib/youtube-audio.ts`).

## Dependency audit note

The local source review, type checking, linting, tests, and production build are authoritative for this change. A registry-backed `pnpm audit --prod` could not complete because npm registry DNS was unavailable in the execution sandbox; rerun it when network access is available.
