# Auralume production checklist

## Search and media providers

- Configure `YOUTUBE_API_KEY` for the official YouTube Data API search path and pagination. The credential-free HTML fallback is intentionally limited to one page and is monitored through route failures.
- Confirm the intended deployment and audio-only playback model against current YouTube terms before public release. Search availability does not establish playback or distribution rights.
- Keep Internet Archive downloads restricted to the license-validated download route. Re-run the live provider checks in each target region before release.

## Deployment controls

- Put the API routes behind a platform or edge rate limiter shared by every application instance. The in-process limiter is a local abuse guard and is not a distributed production quota.
- Send route failures, latency, and upstream status codes to the deployment's monitoring service without logging OAuth tokens, API keys, media URLs, or user search histories.
- Alert on sustained YouTube/Archive error rates, audio proxy failures, and download validation failures. Keep the credential-free search fallback available when the official API quota is unavailable.

## Data and recovery

- Auralume profile data remains browser-local. Google sign-in imports read-only YouTube metadata and does not provide cross-device Auralume synchronization.
- Browser data deletion must finish IndexedDB and personalization deletion before reporting success. A failure remains visible and retryable.
- Persisted library version 7 expands existing playlists with track snapshots, preferences, equalizer settings, and appearance settings. The migration preserves the prior IDs and fields, so rolling back to version 6 ignores the added fields without deleting them.

## Release evidence

- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
- Run the search evaluation cases in `src/lib/search-evaluation.ts` against recorded provider responses and selected live searches with the production API key. Record expected-result position by region and date.
- Verify playback and equalizer behavior in the supported Chrome, Safari, Firefox, Android, and iOS browser matrix. Web Audio support and background playback vary by browser and operating system.
