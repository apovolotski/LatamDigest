# Latam Digest data pipeline

The shipping iOS app uses public static JSON feeds. This pipeline needs Node.js 24 or later and does not need an OpenAI credential.

```sh
npm ci
npm run check
npm test
npm audit --omit=dev
npm run generate:static
npm run check:coverage
```

The generator reads Google News RSS and writes `docs/api/countries.json`, `manifest.json`, and country/category feeds. It uses browser-safe URLs, stable article IDs, and atomic file replacements. Invalid publication dates are rejected. Failed or empty upstream responses preserve recent successful data for up to seven days; a partially successful refresh retains the original update time and marks those feeds stale. The low-level generator fails if every feed fails. The production command stages output and validates it before replacing the publication; the recovery behavior for provider outages is described below.

RSS requests have a 20-second deadline covering headers and body, with at most three attempts. Network failures, timeouts, HTTP 408/429/5xx, and invalid RSS responses use exponential backoff with jitter. `Retry-After` seconds and dates are honored; a delay over 60 seconds ends that request instead of retrying too soon. Permanent HTTP failures and valid empty feeds are not retried. Five consecutive upstream failures after request retries stop the run before any files are written. Empty feeds do not count toward that circuit breaker. The generator also has a 20-minute overall deadline and the Actions generation step has a 22-minute backstop inside the 30-minute job.

Diagnostics report a controlled failure category, HTTP status where available, attempt count, and a final refresh count. Response bodies, request URLs, headers, and raw provider exceptions are never logged or written to public feed metadata. Provider outages never publish old data as fresh. The production recovery wrapper can retain a complete verified publication while explicitly reporting degraded health.

## Provider outage recovery

`npm run generate:static` runs `scripts/refresh-static-feeds.mjs`. Each full attempt runs in an isolated copy of the current publication; invalid or failed candidates cannot overwrite published feeds. A complete candidate must pass the same coverage checks used by Actions before a directory swap replaces the publication.

If five consecutive feeds exhaust request retries with a transient upstream error, the wrapper waits at least 60 seconds and retries the entire refresh once. Provider `Retry-After` is honored; delays over five minutes skip the extra attempt rather than issuing a premature request or overrunning the job budget. Cancellation, permanent HTTP errors, filesystem problems, unexpected programming errors, empty refreshes and invalid generated coverage remain fatal.

If the provider remains unavailable, recovery succeeds **only** when all country/category files pass coverage, URL, identity, relevance, and publication-date checks and every feed's actual `updatedAt` is within the last 24 hours. A missing, corrupt, expired or incomplete cache still fails the workflow. This recovery limit is stricter than ordinary per-feed cache retention. Repeated recovery runs never renew it.

During cached recovery publication dates, the manifest generation time, and each feed’s actual refresh timestamp remain unchanged. Articles older than thirteen days are pruned before publication, leaving a full 24-hour margin before the validator’s fourteen-day limit. Both fresh and cached candidates must pass this publication margin; coverage must still be complete after pruning. The manifest marks all retained feeds stale and reports zero newly refreshed feeds. A separate public `docs/api/refresh-status.json` records `state: degraded`, `mode: cached`, zero newly refreshed feeds, the preserved publication timestamp, the number of cached feeds, attempt count and a sanitized provider error. Normal refreshes record healthy or partial/degraded status. Actions also shows the outcome in its job summary and logs a warning for cached recovery. Thus a temporary provider outage with working recent feeds does not send a failed-job email, while real coverage failures and prolonged outages remain visible failures. This changes recovery behavior, not GitHub notification settings.

### October 19, 2026 incident

[Run 39257124872](https://github.com/apovolotski/LatamDigest/actions/runs/39257124872) passed all 32 tests and the dependency audit. Google News returned HTTP 503 for each of three attempts on the first five feeds (15 requests). The generator then opened its circuit breaker and exited after about 2 minutes 28 seconds. The prior publication from 04:34 UTC still contained all 240 valid feeds. The missing behavior was a full-run cooldown/retry and verified cache recovery after the circuit opened; it was not a timeout, parsing failure or Git push failure.

Regression tests reproduce all 30 HTTP 503 responses across both full attempts, successful provider recovery, damaged and expired caches, unchanged timestamps across repeated outages, permanent HTTP failures, programming errors, cancellation, validation failure, partial refreshes and first publication. Time-dependent test articles use relative dates so tests do not fail merely as calendar time advances.

## Country and category coverage

All 24 countries have ten feed definitions. Searches use Spanish, Brazilian Portuguese, French, Dutch (Suriname), or English with local country names and category vocabulary. `Latest` searches for recent reporting rather than requiring the literal English words “latest news”. This fixes the six empty queries observed on October 18: Dominican Republic/economy, Nicaragua/economy, and French Guiana/latest, culture, economy, and world. Direct RSS probes found 0 results for each old query; localized economy queries returned 81 results for the Dominican Republic and 71 for Nicaragua.

A feed with fewer than three relevant articles expands its search from 3 to 7 days for headlines, or 7 to 14 days for categories. A final English-language search uses the same country and category when needed. Queries use at most six topical alternatives; overly long OR expressions returned mostly historical matches in live probes, so publication dates are checked independently. Trinidad and Tobago searches include both island names and recognize the local abbreviation “T&T”. Searches never substitute another country or general news for a category. Articles must have a country/place/demonym and category vocabulary in the headline, a safe URL, and a publication date within the chosen window. These are conservative keyword relevance checks, not a semantic classifier. French Guiana recognizes local place names and excludes Porsche Cayenne name collisions. All candidates are deduplicated by URL identity and headline/source, then sorted before taking the newest twelve. RSS text remains text, including numeric publisher names such as `442`.

The manifest records search languages, lookback window, fallback use, and aggregate coverage counts. Publication dates are never rewritten to make older stories appear new. Cached fallback keeps the original refresh timestamp, is retained for at most 24 hours in both partial and full outage recovery, and also excludes stories older than thirteen days or failing the same relevance checks. The reader validation limit remains fourteen days, leaving 24 hours of safety between publication and expiration. Small news markets may legitimately have only one or two matching stories; those are reported as sparse rather than padded with unrelated headlines.

`npm run check:coverage` verifies the complete country/category matrix and every feed file before Actions can commit. Missing or empty feeds, mismatched counts, duplicate IDs, unsafe URLs, expired timestamps, and articles failing headline/date checks block publication. Recent cache use and sparse feeds produce visible workflow warnings. Regression tests cover localized and expanded searches, English fallback, wrong-country/category results, numeric publishers, date limits, deduplication, and coverage verification.

The GitHub Actions job runs on demand and every six hours, serializes overlapping runs, and validates dependencies and tests before generating feeds. Static data is served from this repository; publisher links may pass through Google News redirects.

### October 18, 2026 incident

[Run 39142145369](https://github.com/apovolotski/LatamDigest/actions/runs/39142145369) passed dependency installation, syntax checks, all six existing tests, and the audit. Every one of its 240 feed refreshes failed; the generator then explicitly exited with `All RSS requests failed; do not publish this refresh.` Publication was skipped. It was not a job timeout or a Git push permission error. [Run 39164132148](https://github.com/apovolotski/LatamDigest/actions/runs/39164132148) subsequently succeeded from the same source revision, refreshing 234 feeds.

The old generator tried each request once and discarded every underlying exception, including HTTP status, network errors, and invalid-response errors. The historical log therefore cannot establish which specific upstream condition caused that run-wide failure. The fix addresses this confirmed handling defect with bounded recovery, early termination during sustained failure, preserved publications, and safe diagnostics that distinguish the conditions on future runs.

### October 23 dependency audit incident

[Run 40026114377](https://github.com/apovolotski/LatamDigest/actions/runs/40026114377) passed all 147 tests, then stopped at `npm audit` before feed generation. The newly reviewed [Zod advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) affects versions below 4.6.6. The optional AI worker used Zod 3, and its older OpenAI SDK required that major version. The dependency audit correctly blocked the job; this was separate from RSS availability or language matching, and no publication was attempted.

The backend now requires Zod 4.6.7 or newer and a compatible OpenAI SDK 6. The AI worker limits response arrays to ten stories before item validation. Regression tests use the actual SDK with a simulated transport to cover normal synthesis, truncated JSON recovery, malformed and oversized arrays, compact retries and sparse windows without credentials or paid requests. The lockfile and blocking dependency audit remain part of the workflow; future advisories may still require another tested dependency update.

## Optional AI worker

`npm start` serves the legacy cached-digest API. Its public routes cannot trigger AI generation or use `?refresh=true`. Empty caches return 503. AI generation runs only on the configured cron schedule when `OPENAI_API_KEY` exists on the server; the first scheduled run warms the cache. Concurrent refreshes coalesce into a single provider request, and failures keep the prior digest.

The app's default static pipeline does not use this worker. Deploying it requires separately configuring the host, a fresh server-only secret, quotas, monitoring, and the intended feed URL. These are not configured by the source changes alone. Do not restore or reuse the key exposed in the earlier conversation. Never send it to iOS or commit `.env` files.


### Publication age rollover regression

The first monitored scheduled recovery (run 39333988284) correctly preserved the cache on October 19. A Suriname sports article dated October 6 at 00:30:28 UTC was within fourteen days when the job published at 22:23 UTC, but expired before the next scheduled run. Validation at October 20 00:51 UTC reproduced this time-dependent failure. Publication now filters fresh results and retained cache to thirteen days and independently enforces the 24-hour margin before promotion. Expired and soon-expiring removal counts are reported separately. Regression tests advance validation by a full day, verify source timestamps remain unchanged, and reject newly generated candidates lacking the margin.
