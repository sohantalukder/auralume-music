# Auralume

Auralume is an audio-only personal music web app built with Next.js. It searches YouTube for broad song coverage and plays YouTube's audio-only AAC/M4A stream through the native player, streams and downloads Creative Commons and public-domain MP3 audio from Internet Archive, and can optionally play MP3, AAC, WAV, and OGG files selected from your device. There is no account, sign-in, subscription, hosted profile database, visible video player, or music-upload server.

## Music sources

| Source | Playback | Storage |
| --- | --- | --- |
| YouTube search | Native HTML5 audio player | Resolves and proxies the original audio-only AAC/M4A stream; no video is loaded or stored |
| Internet Archive open-audio catalog | Native HTML5 audio player | Streams from `archive.org`; optional licensed MP3 downloads save to the device |
| Optional audio files from this device | Native HTML5 audio player | Browser IndexedDB only |

Auralume does not transcode YouTube media to MP3. It resolves YouTube's existing audio-only AAC/M4A representation and streams it through the same native audio engine used by other sources; no video representation is fetched. Open audio streams from the fixed Internet Archive host. When a listener explicitly downloads a licensed MP3, Auralume revalidates its current Archive metadata and streams that exact file as an attachment. Device files stay in the current browser.

## Features

- Responsive desktop and mobile application shell
- Native controls for every source (YouTube, Archive, device audio): seek, volume, queue, shuffle, repeat, likes, history, keyboard shortcuts, and Media Session controls
- Broad song search through YouTube with audio-only native playback
- Type-ahead suggestions from recent searches, the synced library, and current results
- Open-audio search and recommendations from the Internet Archive catalog
- Validated MP3 downloads for Creative Commons and public-domain Archive tracks
- Optional on-device library stored only in browser IndexedDB
- Full-screen player with lyrics in a bottom sheet
- Durable browser-local playlists, preferences, equalizer, likes, history, and personalization
- Light/dark/system appearance with optional custom interface colors
- Installable PWA shell

## Requirements

- Node.js 24+
- pnpm 10+

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Online search and playback work without API credentials. For production search, set `YOUTUBE_API_KEY` to use the official YouTube Data API and enable paginated results. Without it, Auralume falls back to the public YouTube results page; that fallback is limited to the first result batch and can change when YouTube changes its page structure.

## Privacy

- Online search terms are sent to YouTube and Internet Archive. Selecting a YouTube result asks the Auralume server to resolve and proxy its audio-only representation; YouTube receives those server-side search and media requests.
- Internet Archive audio streams from `archive.org`.
- An explicit MP3 download is revalidated against Internet Archive metadata and proxied to the browser without conversion.
- Optional device audio files remain in the current browser’s IndexedDB and are never uploaded.
- Track title and artist metadata are sent to LRCLIB only when lyrics are opened.
- Listening history, likes, playlists, preferences, equalizer, custom colors, searches, and recommendation signals remain in browser storage and do not sync across devices.
- No music or profile data is written to an Auralume hosted database.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Browser tests mock the Archive catalog for deterministic online playback flows and use a local WAV fixture for optional device import.

## Browser limitations

- The first playback may require a user gesture.
- YouTube audio may be unavailable because of account requirements, regional restrictions, age restrictions, removal, or upstream protocol changes. YouTube also frequently challenges or blocks datacenter IP ranges (including serverless hosts such as Vercel); when a stream fails after one retry the player skips to the next track.
- Background and lock-screen playback works because every source plays through one native audio element with Media Session metadata. With the equalizer enabled, iOS may still pause audio when it suspends Web Audio; the player resumes it when possible.
- YouTube result order is the order returned to Auralume by its configured provider and can differ from a signed-in, region-personalized YouTube session. The credential-free fallback has no pagination.

## GitHub CI/CD

The `CI/CD` workflow runs type-checking, linting, tests, and a production build for pull requests and `main`. Successful `main` builds deploy to Vercel. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub Actions secrets, and set `NEXT_PUBLIC_SITE_URL` in the Vercel production environment so canonical and social metadata use the public domain.
- The equalizer uses Web Audio and may be bypassed by browsers that do not support media-element audio processing.
- Background and lock-screen controls depend on browser and operating-system support.
- A browser or OS may stop playback when it terminates the page.
- IndexedDB files are device/browser-specific and do not sync to another device.
- Clearing site data removes local files, playlists, likes, and listening history.
