import { articleID, isWebURL } from "../src/articleIdentity.js";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { FeedRequestError, UpstreamUnavailableError, feedFailureLabel, fetchRSS } from "../src/rssClient.js";
import { feedConfigs, searchPlans, isRelevantArticle } from "../src/feedSearch.js";
import { MAX_PUBLICATION_AGE_MS } from "../src/feedFreshness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const countriesPath = path.resolve(
  __dirname,
  "../../LatamDigest/Resources/Countries.json"
);
const outputRoot = path.resolve(__dirname, "../../docs/api");

export async function generateFeeds({
  countries,
  destination = outputRoot,
  fetchFeed = fetchArticlesForFeed,
  feeds = feedConfigs,
  signal = AbortSignal.timeout(20 * 60_000)
} = {}) {
  countries ??= JSON.parse(await fs.readFile(countriesPath, "utf8"));
  let previous = { countries: [] };
  try { previous = JSON.parse(await fs.readFile(path.join(destination, "manifest.json"), "utf8")); } catch {}
  const pending = [];
  const manifest = { generatedAt: new Date().toISOString(), source: "Google News RSS",
    feeds: feeds.map(({ key, label }) => ({ key, label })), countries: [] };
  let succeeded = 0;
  let consecutiveUpstreamFailures = 0;
  const failures = new Map();
  for (const country of countries) {
    const countryManifest = { id: country.id, name: country.name, feeds: {} };
    for (const feed of feeds) {
      if (signal.aborted) throw new Error("Refresh deadline exceeded; no files published.");
      const file = path.join(destination, "countries", country.id,
        ...(["top", "latest"].includes(feed.key) ? [`${feed.key}.json`] : ["category", `${feed.key}.json`]));
      const oldStatus = previous.countries.find(item => item.id === country.id)?.feeds?.[feed.key];
      let articles;
      try {
        articles = await fetchFeed(country, feed, { signal });
        if (!articles.length) throw new FeedRequestError("empty-feed");
      } catch (error) {
        if (signal.aborted) throw new Error("Refresh deadline exceeded; no files published.");
        if (!(error instanceof FeedRequestError)) throw new Error(`Unexpected feed error for ${country.id}/${feed.key}; no files published.`);
        const label = feedFailureLabel(error);
        failures.set(label, (failures.get(label) ?? 0) + 1);
        consecutiveUpstreamFailures = error instanceof FeedRequestError && error.code !== "empty-feed"
          ? consecutiveUpstreamFailures + 1 : 0;
        console.error(`Refresh unavailable for ${country.id}/${feed.key}: ${label}.`);
        if (consecutiveUpstreamFailures >= 5) {
          throw new UpstreamUnavailableError(error);
        }
        articles = null;
      }
      if (articles) {
        consecutiveUpstreamFailures = 0;
        pending.push([file, articles]);
        countryManifest.feeds[feed.key] = { count: articles.length, updatedAt: new Date().toISOString(), stale: false,
          ...(articles.coverage ? { coverage: articles.coverage } : {}) };
        succeeded += 1;
      } else {
        let retained = [];
        if (oldStatus && Date.now() - Date.parse(oldStatus.updatedAt) <= 7 * 24 * 3600_000) {
          try { retained = JSON.parse(await fs.readFile(file, "utf8")); } catch {}
        }
        if (!Array.isArray(retained)) retained = [];
        retained = retained.filter(article => isWebURL(article.url) &&
          Date.parse(article.publishedAt) >= Date.now() - MAX_PUBLICATION_AGE_MS &&
          Date.parse(article.publishedAt) <= Date.now() + 3600_000 &&
          (!feedConfigs.includes(feed) || isRelevantArticle(article, country, feed, { lookbackDays: 14 })));
        pending.push([file, retained]);
        countryManifest.feeds[feed.key] = { count: retained.length,
          updatedAt: retained.length ? oldStatus.updatedAt : null,
          stale: true, error: "Feed refresh unavailable." };
        console.error(`Retained ${retained.length} articles for ${country.id}/${feed.key}.`);
      }
    }
    manifest.countries.push(countryManifest);
    console.log(`${country.id}: ${Object.values(countryManifest.feeds).filter(status => !status.stale).length}/${feeds.length} feeds refreshed.`);
  }
  const statuses = manifest.countries.flatMap(country => Object.values(country.feeds));
  manifest.coverage = { totalFeeds: statuses.length, freshFeeds: succeeded,
    staleFeeds: statuses.filter(status => status.stale).length,
    emptyFeeds: statuses.filter(status => !status.count).length,
    sparseFeeds: statuses.filter(status => status.count > 0 && status.count < 3).length };
  console.log(`Feed refresh: ${succeeded}/${countries.length * feeds.length} refreshed; failures=${JSON.stringify(Object.fromEntries(failures))}`);
  // A total outage must leave the entire previous publication byte-for-byte intact.
  if (succeeded) {
    if (signal.aborted) throw new Error("Refresh deadline exceeded; no files published.");
    for (const [file, payload] of pending) await writeJson(file, payload);
    await writeJson(path.join(destination, "countries.json"), countries);
    await writeJson(path.join(destination, "manifest.json"), manifest);
  }
  return { manifest, succeeded };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { succeeded } = await generateFeeds();
    if (!succeeded) throw new Error("All feeds failed; no files published.");
    console.log(`Static feeds generated in ${outputRoot}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export async function fetchArticlesForFeed(country, feedConfig, options) {
  // Custom queries remain injectable for focused tests and callers. Production
  // feeds always use the localized plans and headline/date relevance checks.
  const plans = feedConfig.query ? [{ query: feedConfig.query({ countryName: country.name, countryCode: country.id }),
    locale: localeForCountry(country.id) }] : searchPlans(country, feedConfig);
  const deduped = new Map();
  const seenHeadlines = new Set();
  const languages = new Set();
  let searches = 0;
  let lookbackDays = 0;
  let fallbackUnavailable = false;
  for (const plan of plans) {
    const url = new URL("https://news.google.com/rss/search");
    url.searchParams.set("q", plan.query);
    for (const [key, value] of Object.entries(plan.locale)) url.searchParams.set(key, value);
    let parsed;
    searches++;
    try { parsed = await fetchRSS(url, options); }
    catch (error) {
      if (!deduped.size || options?.signal?.aborted) throw error;
      fallbackUnavailable = true;
      break;
    }
    lookbackDays = Math.max(lookbackDays, plan.lookbackDays ?? 0);
    languages.add(plan.language);
    let items = parsed?.rss?.channel?.item ?? [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    for (const item of items) {
      const article = toArticle(item, country, feedConfig);
      if (!article || (!feedConfig.query && (!isRelevantArticle(article, country, feedConfig, plan) ||
          Date.parse(article.publishedAt) < Date.now() - MAX_PUBLICATION_AGE_MS))) continue;
      const dedupeKey = `${article.title.toLowerCase()}|${article.sourceName.toLowerCase()}`;
      if (!deduped.has(article.id) && !seenHeadlines.has(dedupeKey)) {
        deduped.set(article.id, article);
        seenHeadlines.add(dedupeKey);
      }
    }
    if (deduped.size >= 3 || feedConfig.query) break;
  }
  const articles = Array.from(deduped.values()).sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt)).slice(0, 12);
  if (!feedConfig.query) articles.coverage = { languages: [...languages], lookbackDays,
    searches, fallbackUsed: searches > 1, fallbackUnavailable };
  return articles;
}

export function toArticle(item, country, feedConfig) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const rawTitle = text(item.title);
  const sourceName = normalizeSourceName(item.source, rawTitle);
  const title = stripSourceSuffix(rawTitle, sourceName);
  const url = text(item.link);

  if (!title || !isWebURL(url)) {
    return null;
  }

  const publishedAt = normalizeDate(item.pubDate);
  if (!publishedAt) return null;
  const snippet = buildSnippet(country, feedConfig, sourceName);
  const id = articleID(url);

  return {
    id,
    title,
    snippet,
    url,
    sourceName,
    sourceLogoURL: null,
    publishedAt
  };
}

function normalizeSourceName(sourceNode, rawTitle) {
  const rawSource = typeof sourceNode === "string" || typeof sourceNode === "number"
    ? sourceNode : sourceNode?.["#text"] ?? sourceNode?.text;
  const source = typeof rawSource === "number" ? String(rawSource) : text(rawSource);
  if (source) return source;

  const match = rawTitle.match(/\s-\s([^–-]+)$/);
  return match ? match[1].trim() : "Google News";
}

function stripSourceSuffix(title, sourceName) {
  if (!title) {
    return "";
  }

  const suffix = ` - ${sourceName}`;
  if (title.endsWith(suffix)) {
    return title.slice(0, -suffix.length).trim();
  }

  return title.trim();
}

function buildSnippet(country, feedConfig, sourceName) {
  const feedLabel = feedConfig.label.toLowerCase();
  return `${feedConfig.label} coverage for ${country.name} via ${sourceName} on Google News. Curated from recent ${feedLabel} reporting.`;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function localeForCountry(countryCode) {
  if (countryCode === "BR") {
    return { hl: "pt-BR", gl: "BR", ceid: "BR:pt-BR" };
  }

  if (countryCode === "GF") {
    return { hl: "fr", gl: "FR", ceid: "FR:fr" };
  }

  if (["TT", "GY", "SR"].includes(countryCode)) {
    return { hl: "en-US", gl: "US", ceid: "US:en" };
  }

  return { hl: "es-419", gl: countryCode, ceid: `${countryCode}:es-419` };
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = filePath + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(payload, null, 2) + "\n", "utf8");
  await fs.rename(temporary, filePath);
}
