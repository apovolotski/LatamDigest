# Latam Digest data pipeline

The shipping iOS app uses public static JSON feeds. This pipeline needs Node.js 24 or later and does not need an OpenAI credential.

```sh
npm ci
npm run check
npm test
npm audit --omit=dev
npm run generate:static
```

The generator reads Google News RSS and writes `docs/api/countries.json`, `manifest.json`, and country/category feeds. It uses browser-safe URLs, stable article IDs, and atomic file replacements. Invalid publication dates are rejected. Failed or empty upstream responses preserve recent successful data for up to seven days; a partially successful refresh retains the original update time and marks those feeds stale. If every feed fails, the process exits unsuccessfully and leaves all previously published files untouched.

RSS requests have a 20-second deadline covering headers and body, with at most three attempts. Network failures, timeouts, HTTP 408/429/5xx, and invalid RSS responses use exponential backoff with jitter. `Retry-After` seconds and dates are honored; a delay over 60 seconds ends that request instead of retrying too soon. Permanent HTTP failures and valid empty feeds are not retried. Five consecutive upstream failures after request retries stop the run before any files are written. Empty feeds do not count toward that circuit breaker. The generator also has a 20-minute overall deadline and the Actions generation step has a 22-minute backstop inside the 30-minute job.

Diagnostics report a controlled failure category, HTTP status where available, attempt count, and a final refresh count. Response bodies, request URLs, headers, and raw provider exceptions are never logged or written to public feed metadata. An outage remains a failed workflow rather than publishing old data as fresh.

The GitHub Actions job runs on demand and every six hours, serializes overlapping runs, and validates dependencies and tests before generating feeds. Static data is served from this repository; publisher links may pass through Google News redirects.

### October 18, 2026 incident

[Run 39142145369](https://github.com/apovolotski/LatamDigest/actions/runs/39142145369) passed dependency installation, syntax checks, all six existing tests, and the audit. Every one of its 240 feed refreshes failed; the generator then explicitly exited with `All RSS requests failed; do not publish this refresh.` Publication was skipped. It was not a job timeout or a Git push permission error. [Run 39164132148](https://github.com/apovolotski/LatamDigest/actions/runs/39164132148) subsequently succeeded from the same source revision, refreshing 234 feeds.

The old generator tried each request once and discarded every underlying exception, including HTTP status, network errors, and invalid-response errors. The historical log therefore cannot establish which specific upstream condition caused that run-wide failure. The fix addresses this confirmed handling defect with bounded recovery, early termination during sustained failure, preserved publications, and safe diagnostics that distinguish the conditions on future runs.

## Optional AI worker

`npm start` serves the legacy cached-digest API. Its public routes cannot trigger AI generation or use `?refresh=true`. Empty caches return 503. AI generation runs only on the configured cron schedule when `OPENAI_API_KEY` exists on the server; the first scheduled run warms the cache. Concurrent refreshes coalesce into a single provider request, and failures keep the prior digest.

The app's default static pipeline does not use this worker. Deploying it requires separately configuring the host, a fresh server-only secret, quotas, monitoring, and the intended feed URL. These are not configured by the source changes alone. Do not restore or reuse the key exposed in the earlier conversation. Never send it to iOS or commit `.env` files.
