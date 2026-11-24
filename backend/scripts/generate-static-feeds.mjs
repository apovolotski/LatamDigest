import { publisherFetch } from '../src/publisherHttp.js';
import {fetchPublisherIndex} from '../src/publisherIndex.js';
import {fetchPublisherNewsSitemap} from '../src/publisherNewsSitemap.js';
import { fetchPublisherArchive } from '../src/publisherArchive.js';
import { articleID, isWebURL } from "../src/articleIdentity.js";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { FeedRequestError, UpstreamUnavailableError, feedFailureLabel, fetchRSS } from "../src/rssClient.js";
import { feedConfigs, searchPlans, isRelevantArticle } from "../src/feedSearch.js";
import { verifyPublisherArticle } from "../src/publisherArticle.js";
import { publisherSourcesFor } from "../src/publisherSources.js";
import { allowsUnavailableFeed, MAX_CACHE_AGE_MS, MAX_PUBLICATION_AGE_MS } from "../src/feedFreshness.js";

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
  source = "Google News RSS with direct publisher fallbacks",
  signal = AbortSignal.timeout(20 * 60_000)
} = {}) {
  countries ??= JSON.parse(await fs.readFile(countriesPath, "utf8"));
  let previous = { countries: [] };
  try { previous = JSON.parse(await fs.readFile(path.join(destination, "manifest.json"), "utf8")); } catch {}
  const pending = [];
  const requestContext = createFeedRequestContext();
  const manifest = { generatedAt: new Date().toISOString(), source,
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
        articles = await fetchFeed(country, feed, { signal, requestContext });
        if (!articles.length) throw new FeedRequestError("empty-feed");
      } catch (error) {
        if (signal.aborted) throw new Error("Refresh deadline exceeded; no files published.");
        if (!(error instanceof FeedRequestError)) throw new Error(`Unexpected feed error for ${country.id}/${feed.key}; no files published.`);
        const label = feedFailureLabel(error);
        failures.set(label, (failures.get(label) ?? 0) + 1);
        consecutiveUpstreamFailures = error instanceof FeedRequestError && error.code !== "empty-feed"
          ? consecutiveUpstreamFailures + 1 : 0;
        console.error(`Refresh unavailable for ${country.id}/${feed.key}: ${label}.`);
        if (consecutiveUpstreamFailures >= 5 && !requestContext.primary.blocked) {
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
        const updated = Date.parse(oldStatus?.updatedAt), now = Date.now();
        if (Number.isFinite(updated) && now - updated <= MAX_CACHE_AGE_MS && updated <= now + 3600_000) {
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
          ...(!retained.length && allowsUnavailableFeed(country.id, feed.key)
            ? { stale: false, unavailable: true } : { stale: true }),
          error: "Feed refresh unavailable." };
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
  if (!succeeded && requestContext.primary.failure) throw new UpstreamUnavailableError(requestContext.primary.failure);
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

// One context per generation, never persisted or shared with the next refresh.
// Reuse each RSS response (including failures) across categories. Reading it
// does not change article dates or make an old publication cache fresh.
export function createFeedRequestContext() {
  return { publisherRSS: new Map(), publisherArticles: new Map(), primary: { failures: 0, blocked: false, failure: null } };
}

export async function fetchArticlesForFeed(country, feedConfig, options = {}) {
  const requestContext = options.requestContext ?? createFeedRequestContext();
  options = { ...options, requestContext };
  const primary = requestContext.primary;
  // Custom queries remain injectable for focused tests and callers. Production
  // feeds always use the localized plans and headline/date relevance checks.
  const plans = feedConfig.query ? [{ query: feedConfig.query({ countryName: country.name, countryCode: country.id }),
    locale: localeForCountry(country.id) }] : searchPlans(country, feedConfig);
  const deduped = new Map();
  const seenHeadlines = new Set();
  const languages = new Set();
  let searches = 0;
  let lookbackDays = 0;
  let fallbackUnavailable = primary.blocked;
  let primaryFailure = primary.blocked ? primary.failure : null;
  for (const plan of primary.blocked ? [] : plans) {
    const url = new URL("https://news.google.com/rss/search");
    url.searchParams.set("q", plan.query);
    for (const [key, value] of Object.entries(plan.locale)) url.searchParams.set(key, value);
    let parsed;
    searches++;
    try { parsed = await fetchRSS(url, options); primary.failures = 0; }
    catch (error) {
      if (!(error instanceof FeedRequestError) || options?.signal?.aborted) throw error;
      primaryFailure = error;
      primary.failure = error;
      primary.failures++;
      if (primary.failures >= 5) {
        primary.blocked = true;
        console.warn("Google RSS repeatedly unavailable; independent publisher recovery will continue for every remaining feed.");
      }
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
  const publishers = new Set();
  if (!feedConfig.query && deduped.size < 3) {
    const fallback = await (options?.fetchPublisher ?? fetchPublisherArticles)(country, feedConfig, options);
    for (const article of fallback) {
      const key = `${article.title.toLowerCase()}|${article.sourceName.toLowerCase()}`;
      // Prefer the original publisher's URL/date over Google's syndicated copy
      // of the same headline. Never create a date from the retrieval time.
      for (const [id, existing] of deduped) {
        if (`${existing.title.toLowerCase()}|${existing.sourceName.toLowerCase()}` === key) deduped.delete(id);
      }
      deduped.set(article.id, article);
      seenHeadlines.add(key);
      publishers.add(article.sourceName);
    }
  }
  if (!deduped.size && primaryFailure) throw primaryFailure;
  const articles = Array.from(deduped.values()).sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt)).slice(0, 12);
  if (!feedConfig.query) articles.coverage = { languages: [...languages], lookbackDays,
    searches, fallbackUsed: searches > 1 || publishers.size > 0, fallbackUnavailable,
    ...(publishers.size ? { publishers: [...publishers] } : {}) };
  return articles;
}

function publisherText(value) {
  if (typeof value !== "string") return "";
  const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
  // WordPress embeds HTML entities inside RSS CDATA. Decode one layer for the
  // displayed headline and URL; never derive dates from feed/build timestamps.
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (entity, code) => {
    if (!code.startsWith("#")) return entities[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point >= 32 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
  }).trim();
}

export async function fetchPublisherArticles(country, feed, options = {}) {
  options = { ...options, requestContext: options.requestContext ?? createFeedRequestContext() };
  const selected = new Map();
  const minimumPublishers = Math.max(1, Math.min(3, Number(options.minimumPublishers) || 2));
  const minimumHeadroomHours = Math.max(0, Math.min(72, Number(options.minimumHeadroomHours) || 0));
  const hasHeadroom = article => Date.parse(article.publishedAt) + MAX_PUBLICATION_AGE_MS - Date.now() >= minimumHeadroomHours * 3600000;
  const hasPublisher = source => [...selected.values()].some(a => a.sourceName === source.name && hasHeadroom(a));
  const enough = () => selected.size >= 3 && new Set([...selected.values()].filter(hasHeadroom).map(a => a.sourceName)).size >= minimumPublishers;
  const cache = options.requestContext?.publisherRSS ?? new Map();
  const sources = publisherSourcesFor(country, feed);
  async function load(source) {
    try {
      // Three requests at a time with short per-request deadlines prevent
      // unavailable publishers from monopolizing the overall refresh budget.
      if (source.kind === "publisher-index") return await fetchPublisherIndex(source, options);
      if (source.kind === "news-sitemap") return await fetchPublisherNewsSitemap(source, options);
      if (["wordpress", "outremers"].includes(source.kind)) return await fetchPublisherArchive(source, options);
      if (!cache.has(source.url)) cache.set(source.url, fetchRSS(new URL(source.url),
        { ...options, fetchImpl: (url, requestOptions) => (options.fetchImpl ?? publisherFetch)(url, { ...requestOptions, allowedHosts: [new URL(source.url).hostname, ...source.hosts] }), timeoutMs: Math.min(options.timeoutMs ?? 8_000, 8_000) }));
      return await cache.get(source.url);
    }
    catch (error) {
      options.signal?.throwIfAborted();
      if (!(error instanceof FeedRequestError)) throw error;
      return null;
    }
  }
  for (let offset = 0; offset < sources.length && !enough(); offset += 3) {
    options.signal?.throwIfAborted();
    const batch = sources.slice(offset, offset + 3);
    const responses = await Promise.all(batch.map(load));
    for (const [index, source] of batch.entries()) {
      const parsed = responses[index];
      // Once this publisher supplied enough stories, keep looking at other
      // publishers instead of treating additional sections as independence.
      if (selected.size >= 3 && hasPublisher(source)) continue;
      let items = parsed?.rss?.channel?.item ?? [];
      if (!Array.isArray(items)) items = [items];
      const candidates = [];
      for (const item of items) {
        const link = publisherText(item?.link);
        if (!isWebURL(link)) continue;
        const url = new URL(link);
        if (url.protocol !== "https:" || !source.hosts.includes(url.hostname) || url.username || url.password || url.port) continue;
        // The publishers append campaign parameters to every feed link. Remove
        // only those known tracking parameters before computing the stable ID.
        for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_")) url.searchParams.delete(key);
        const article = toArticle({ ...item, title: publisherText(item.title), link: url.href, source: source.name }, country, feed);
        if (!article || !isRelevantArticle(article, country, feed, { lookbackDays: MAX_PUBLICATION_AGE_MS / 86_400_000 })) continue;
        article.snippet = `${feed.label} reporting from ${source.name}.`;
        candidates.push(article);
      }
      // Verify original publication instants on the actual publisher page.
      // RSS build/update times are not sufficient when publishers reuse them.
      for (let start = 0; start < Math.min(candidates.length, 12) && !enough() &&
          (selected.size < 3 || !hasPublisher(source)); start += 3) {
        const checked = await Promise.all(candidates.slice(start, start + 3).map(article =>
          (options.verifyPublisherArticle ?? verifyPublisherArticle)(article, source, options)));
        for (const article of checked) if (article && isRelevantArticle(article, country, feed,
          { lookbackDays: MAX_PUBLICATION_AGE_MS / 86_400_000 })) selected.set(article.id, article);
      }
    }
  }
  const articles = [...selected.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 12);
  if (articles.length) articles.coverage = { publishers: [...new Set(articles.map(a => a.sourceName))],
    fallbackUsed: true, independentPublisher: true };
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
