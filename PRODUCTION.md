# Auralume production checklist

## Search and media providers

- Configure `YOUTUBE_API_KEY` for the official YouTube Data API search path and pagination. The credential-free HTML fallback is intentionally limited to one page and is monitored through route failures.
- Confirm the intended deployment and audio-only playback model against current YouTube terms before public release. Search availability does not establish playback or distribution rights. Server-side resolving and proxying of YouTube audio is not permitted by YouTube's terms; treat it as a personal-use risk.
- YouTube can challenge or block datacenter IPs (Vercel included). Watch function logs for `YouTube audio stream unavailable`; the client retries once and then skips the track.
- The audio proxy answers every request with at most 1 MB (`/api/youtube/audio`, `maxDuration = 60`). Requests without a `Range` header receive the first chunk as a 206. Fallback clients limited to 16 KB upstream ranges are stitched server-side into one response.
- The PoToken fallback (`src/lib/youtube-potoken.ts`) runs YouTube's attestation script with `new Function` and assigns jsdom globals (`window`, `document`, `location`) onto the server process. It is only reached when both unsigned clients fail; isolate it in a separate function or worker if it is used regularly.
- Keep Internet Archive downloads restricted to the license-validated download route. Re-run the live provider checks in each target region before release.

## Deployment controls

- Put the API routes behind a platform or edge rate limiter shared by every application instance (for example Upstash Redis or Vercel Firewall rules). The in-process limiter is a per-instance abuse guard with bounded memory, not a distributed production quota.
- Send route failures, latency, and upstream status codes to the deployment's monitoring service without logging API keys, media URLs, or user search histories.
- Alert on sustained YouTube/Archive error rates, audio proxy failures, and download validation failures. Keep the credential-free search fallback available when the official API quota is unavailable.

## Data and recovery

- Auralume has no accounts; all library data remains browser-local and does not sync across devices.
- Browser data deletion must finish IndexedDB and personalization deletion before reporting success. A failure remains visible and retryable.
- Persisted library version 7 expands existing playlists with track snapshots, preferences, equalizer settings, and appearance settings. The migration preserves the prior IDs and fields, so rolling back to version 6 ignores the added fields without deleting them.
- Version 9 adds `likedTracks` snapshots (built from known tracks for existing likes) so liked songs stay listed after leaving history. Rolling back ignores the field; `likedIds` is unchanged.

## Release evidence

- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
- Run the search evaluation cases in `src/lib/search-evaluation.ts` against recorded provider responses and selected live searches with the production API key. Record expected-result position by region and date.
- Verify playback and equalizer behavior in the supported Chrome, Safari, Firefox, Android, and iOS browser matrix. Web Audio support and background playback vary by browser and operating system. On a phone: start a YouTube track, lock the screen, and confirm audio continues, lock-screen controls work, and the next track starts.
- `Content-Security-Policy-Report-Only` is sent from `next.config.ts`. Review violations, then switch to an enforcing, nonce-based policy.

## Known follow-ups

- Shared rate limiter service (see above).
- PNG and `any`-purpose manifest icons; the manifest currently ships a single maskable SVG.
- Internationalization of UI strings.
- Archive search paginates by item, so tracks dropped by the 20-result slice are unreachable.
- The credential-free YouTube search scraper reads the whole page before applying its size cap.
