import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { generateFeeds } from "./generate-static-feeds.mjs";
import { checkCoverage } from "./check-feed-coverage.mjs";
import { UpstreamUnavailableError } from "../src/rssClient.js";
import { feedConfigs } from "../src/feedSearch.js";
import { MAX_ARTICLE_AGE_MS, MAX_CACHE_AGE_MS, MAX_PUBLICATION_AGE_MS, PUBLICATION_SAFETY_MS } from "../src/feedFreshness.js";

const outputRoot = fileURLToPath(new URL("../../docs/api", import.meta.url));

// A provider outage is recoverable only while every published feed is valid and
// was actually refreshed in the last day. Reading a cache never renews its age.
async function verifiedCache(destination, countries, now) {
  countries ??= JSON.parse(await fs.readFile(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await fs.readFile(path.join(destination, "manifest.json"), "utf8"));
  if (JSON.stringify(manifest.countries.map(country => country.id).sort()) !== JSON.stringify(countries.map(country => country.id).sort())) {
    throw new Error("Cached coverage is incomplete or invalid; refresh cannot recover safely.");
  }
  const statuses = manifest.countries.flatMap(country => Object.values(country.feeds));
  if (statuses.some(status => !Number.isFinite(Date.parse(status.updatedAt)) ||
      now - Date.parse(status.updatedAt) > MAX_CACHE_AGE_MS || Date.parse(status.updatedAt) > now + 3600_000)) {
    throw new Error("Cached feed refresh timestamps exceed the 24-hour recovery limit.");
  }
  let expiredArticlesRemoved = 0;
  let expiringArticlesRemoved = 0;
  for (const country of countries) {
    const entry = manifest.countries.find(item => item.id === country.id);
    if (JSON.stringify(Object.keys(entry.feeds).sort()) !== JSON.stringify(feedConfigs.map(feed => feed.key).sort())) {
      throw new Error("Cached coverage is incomplete or invalid; refresh cannot recover safely.");
    }
    for (const feed of feedConfigs) {
      const file = path.join(destination, "countries", country.id,
        ...(["top", "latest"].includes(feed.key) ? [`${feed.key}.json`] : ["category", `${feed.key}.json`]));
      let articles;
      try { articles = JSON.parse(await fs.readFile(file, "utf8")); }
      catch { throw new Error("Cached coverage is incomplete or invalid; refresh cannot recover safely."); }
      const status = entry.feeds[feed.key];
      if (!Array.isArray(articles) || articles.length !== status.count) throw new Error("Cached coverage is incomplete or invalid; refresh cannot recover safely.");
      // Leave a full recovery window before the validator's hard age limit.
      // Invalid or future dates remain present so validation still rejects them.
      const retained = articles.filter(article => {
        const published = Date.parse(article.publishedAt);
        if (!Number.isFinite(published) || published >= now - MAX_PUBLICATION_AGE_MS) return true;
        if (published < now - MAX_ARTICLE_AGE_MS) expiredArticlesRemoved++;
        else expiringArticlesRemoved++;
        return false;
      });
      if (retained.length !== articles.length) await fs.writeFile(file, JSON.stringify(retained, null, 2) + "\n");
      entry.feeds[feed.key] = { ...status, count: retained.length, stale: true, error: "Feed refresh unavailable." };
    }
  }
  const current = manifest.countries.flatMap(country => Object.values(country.feeds));
  manifest.coverage = { totalFeeds: current.length, freshFeeds: 0, staleFeeds: current.length,
    emptyFeeds: current.filter(status => !status.count).length,
    sparseFeeds: current.filter(status => status.count > 0 && status.count < 3).length };
  await fs.writeFile(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const report = await checkCoverage({ destination, countries, now, minimumFreshnessMs: PUBLICATION_SAFETY_MS });
  if (report.issues.length) throw new Error("Cached coverage is incomplete or invalid; refresh cannot recover safely.");
  return { report, manifest, expiredArticlesRemoved, expiringArticlesRemoved };
}

async function publishVerified(staged, destination, workspace) {
  const backup = path.join(workspace, "previous");
  let hasPrevious = false;
  try { await fs.rename(destination, backup); hasPrevious = true; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  try { await fs.rename(staged, destination); }
  catch (error) { if (hasPrevious) await fs.rename(backup, destination); throw error; }
}

async function recordStatus(destination, status, summaryFile) {
  const file = path.join(destination, "refresh-status.json");
  await fs.writeFile(file + ".tmp", JSON.stringify(status, null, 2) + "\n");
  await fs.rename(file + ".tmp", file);
  if (summaryFile) {
    await fs.appendFile(summaryFile, `## Static feed refresh: ${status.state}\n\n` +
      `- Refreshed feeds: ${status.refreshedFeeds}/${status.totalFeeds}\n` +
      `- Cached feeds: ${status.cachedFeeds}\n` +
      `- Refresh attempts: ${status.attempts}\n` +
      `- Publication freshness safety margin: ${status.publicationSafetyHours} hours\n` +
      `- Last successful publication: ${status.lastSuccessfulRefreshAt}\n` +
      (status.mode === "cached" ? `\nGoogle News remains unavailable. Verified recent feeds retained; article dates and refresh timestamps are unchanged. ${status.expiredArticlesRemoved} expired and ${status.expiringArticlesRemoved} expiring articles removed. Recovery cache expires after 24 hours.\n` : ""));
  }
}

export async function refreshFeeds({
  destination = outputRoot,
  countries,
  generate = generateFeeds,
  sleep = delay,
  cooldownMs = 60_000,
  now = Date.now,
  signal = AbortSignal.timeout(20 * 60_000),
  summaryFile = process.env.GITHUB_STEP_SUMMARY
} = {}) {
  let upstreamFailure;
  let attempts = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    attempts = attempt;
    signal.throwIfAborted();
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const workspace = await fs.mkdtemp(path.join(path.dirname(destination), ".feed-refresh-"));
    const staged = path.join(workspace, "candidate");
    try {
      try { await fs.cp(destination, staged, { recursive: true }); }
      catch (error) { if (error.code !== "ENOENT") throw error; await fs.mkdir(staged); }
      let result;
      try { result = await generate({ countries, destination: staged, signal }); }
      catch (error) {
        // Configuration, filesystem, validation and programming errors stay fatal.
        if (!(error instanceof UpstreamUnavailableError) || !error.retryable) throw error;
        upstreamFailure = error;
      }
      signal.throwIfAborted();
      if (result) {
        if (!result.succeeded) throw new Error("No feeds refreshed; refusing to publish an empty refresh.");
        const report = await checkCoverage({ destination: staged, countries, now: now(), minimumFreshnessMs: PUBLICATION_SAFETY_MS });
        if (report.issues.length) throw new Error(`Generated feed validation failed: ${report.issues.join(" ")}`);
        const candidateManifest = JSON.parse(await fs.readFile(path.join(staged, "manifest.json"), "utf8"));
        const cached = candidateManifest.countries.flatMap(country => Object.values(country.feeds)).filter(status => status.stale);
        if (cached.some(status => !Number.isFinite(Date.parse(status.updatedAt)) ||
            now() - Date.parse(status.updatedAt) > MAX_CACHE_AGE_MS || Date.parse(status.updatedAt) > now() + 3600_000)) {
          throw new Error("Cached feed refresh timestamps exceed the 24-hour recovery limit.");
        }
        const status = { state: report.stale ? "degraded" : "healthy", mode: "refreshed",
          checkedAt: new Date(now()).toISOString(), lastSuccessfulRefreshAt: result.manifest.generatedAt,
          publicationSafetyHours: PUBLICATION_SAFETY_MS / 3600_000,
          cacheLimitHours: MAX_CACHE_AGE_MS / 3600_000,
          totalFeeds: report.total, refreshedFeeds: result.succeeded, cachedFeeds: report.stale, attempts: attempt };
        await recordStatus(staged, status);
        // Swap only verified output. Roll back if the second rename fails.
        await publishVerified(staged, destination, workspace);
        await recordStatus(destination, status, summaryFile);
        console.log(`Refresh completed: ${status.state}; ${status.refreshedFeeds}/${status.totalFeeds} refreshed; attempts=${attempt}.`);
        return status;
      }
    } finally { await fs.rm(workspace, { recursive: true, force: true }); }
    if (attempt === 1) {
      // A long provider cooldown must not trigger another premature request or
      // consume the job's entire budget. Use the verified cache instead.
      if (upstreamFailure.retryAfterMs > 300_000) break;
      console.warn("Google News unavailable after request retries; pausing before one full refresh retry.");
      await sleep(Math.max(cooldownMs, upstreamFailure.retryAfterMs || 0), undefined, { signal });
    }
  }
  signal.throwIfAborted();
  const workspace = await fs.mkdtemp(path.join(path.dirname(destination), ".feed-refresh-"));
  const staged = path.join(workspace, "candidate");
  try {
    await fs.cp(destination, staged, { recursive: true });
    const { report, manifest, expiredArticlesRemoved, expiringArticlesRemoved } = await verifiedCache(staged, countries, now());
    const status = { state: "degraded", mode: "cached", checkedAt: new Date(now()).toISOString(),
      lastSuccessfulRefreshAt: manifest.generatedAt, totalFeeds: report.total,
      refreshedFeeds: 0, cachedFeeds: report.total, attempts, cacheLimitHours: 24,
      publicationSafetyHours: PUBLICATION_SAFETY_MS / 3600_000,
      expiredArticlesRemoved, expiringArticlesRemoved, failure: upstreamFailure.failure };
    signal.throwIfAborted();
    await recordStatus(staged, status);
    await publishVerified(staged, destination, workspace);
    await recordStatus(destination, status, summaryFile);
    console.warn(`::warning::Google News unavailable; serving ${report.total}/${report.total} verified cached feeds. Health is degraded; original timestamps preserved.`);
    return status;
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await refreshFeeds(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
