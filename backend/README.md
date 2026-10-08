# Latam Digest data pipeline

The shipping iOS app uses public static JSON feeds. This pipeline needs Node.js 24 or later and does not need an OpenAI credential.

```sh
npm ci
npm run check
npm test
npm audit --omit=dev
npm run generate:static
```

The generator reads Google News RSS and writes `docs/api/countries.json`, `manifest.json`, and country/category feeds. It uses bounded request timeouts, browser-safe URLs, stable article IDs, and atomic file replacements. Invalid publication dates are rejected. Failed or empty upstream responses preserve recent successful data for up to seven days; the manifest retains the original update time and marks that feed stale. If every request fails, the process exits unsuccessfully so Actions does not publish the refresh.

The GitHub Actions job runs on demand and every six hours, serializes overlapping runs, and validates dependencies and tests before generating feeds. Static data is served from this repository; publisher links may pass through Google News redirects.

## Optional AI worker

`npm start` serves the legacy cached-digest API. Its public routes cannot trigger AI generation or use `?refresh=true`. Empty caches return 503. AI generation runs only on the configured cron schedule when `OPENAI_API_KEY` exists on the server; the first scheduled run warms the cache. Concurrent refreshes coalesce into a single provider request, and failures keep the prior digest.

The app's default static pipeline does not use this worker. Deploying it requires separately configuring the host, a fresh server-only secret, quotas, monitoring, and the intended feed URL. These are not configured by the source changes alone. Do not restore or reuse the key exposed in the earlier conversation. Never send it to iOS or commit `.env` files.
