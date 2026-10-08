import { articleID, isWebURL } from "../src/articleIdentity.js";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const countriesPath = path.resolve(
  __dirname,
  "../../LatamDigest/Resources/Countries.json"
);
const outputRoot = path.resolve(__dirname, "../../docs/api");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

const feedConfigs = [
  { key: "top", label: "Top", query: ({ countryName }) => `${countryName} when:3d` },
  {
    key: "latest",
    label: "Latest",
    query: ({ countryName }) => `${countryName} latest news when:3d`
  },
  {
    key: "politics",
    label: "Politics",
    query: ({ countryName }) =>
      `${countryName} (politics OR government OR congress OR election) when:7d`
  },
  {
    key: "business",
    label: "Business",
    query: ({ countryName }) =>
      `${countryName} (business OR company OR market OR investment) when:7d`
  },
  {
    key: "sports",
    label: "Sports",
    query: ({ countryName }) =>
      `${countryName} (sports OR football OR soccer OR tournament) when:7d`
  },
  {
    key: "tech",
    label: "Tech",
    query: ({ countryName }) =>
      `${countryName} (technology OR startup OR AI OR software) when:7d`
  },
  {
    key: "culture",
    label: "Culture",
    query: ({ countryName }) =>
      `${countryName} (culture OR music OR film OR art OR books) when:7d`
  },
  {
    key: "crime",
    label: "Crime",
    query: ({ countryName }) =>
      `${countryName} (crime OR police OR court OR violence) when:7d`
  },
  {
    key: "economy",
    label: "Economy",
    query: ({ countryName }) =>
      `${countryName} (economy OR inflation OR central bank OR GDP) when:7d`
  },
  {
    key: "world",
    label: "World",
    query: ({ countryName }) =>
      `${countryName} (foreign affairs OR diplomacy OR international) when:7d`
  }
];

export async function generateFeeds({
  countries,
  destination = outputRoot,
  fetchFeed = fetchArticlesForFeed,
  feeds = feedConfigs
} = {}) {
  countries ??= JSON.parse(await fs.readFile(countriesPath, "utf8"));
  let previous = { countries: [] };
  try { previous = JSON.parse(await fs.readFile(path.join(destination, "manifest.json"), "utf8")); } catch {}
  await fs.mkdir(destination, { recursive: true });
  await writeJson(path.join(destination, "countries.json"), countries);
  const manifest = { generatedAt: new Date().toISOString(), source: "Google News RSS",
    feeds: feeds.map(({ key, label }) => ({ key, label })), countries: [] };
  let succeeded = 0;
  for (const country of countries) {
    const countryManifest = { id: country.id, name: country.name, feeds: {} };
    for (const feed of feeds) {
      const file = path.join(destination, "countries", country.id,
        ...(["top", "latest"].includes(feed.key) ? [`${feed.key}.json`] : ["category", `${feed.key}.json`]));
      const oldStatus = previous.countries.find(item => item.id === country.id)?.feeds?.[feed.key];
      try {
        const articles = await fetchFeed(country, feed);
        if (!articles.length) throw new Error("No recent articles returned.");
        await writeJson(file, articles);
        countryManifest.feeds[feed.key] = { count: articles.length, updatedAt: new Date().toISOString(), stale: false };
        succeeded += 1;
      } catch {
        let retained = [];
        if (oldStatus && Date.now() - Date.parse(oldStatus.updatedAt) <= 7 * 24 * 3600_000) {
          try { retained = JSON.parse(await fs.readFile(file, "utf8")); } catch {}
        }
        if (!Array.isArray(retained)) retained = [];
        await writeJson(file, retained);
        countryManifest.feeds[feed.key] = { count: retained.length,
          updatedAt: retained.length ? oldStatus.updatedAt : null,
          stale: true, error: "Feed refresh unavailable." };
        console.error(`Refresh unavailable for ${country.id}/${feed.key}; retained ${retained.length} articles.`);
      }
    }
    manifest.countries.push(countryManifest);
  }
  await writeJson(path.join(destination, "manifest.json"), manifest);
  return { manifest, succeeded };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { succeeded } = await generateFeeds();
  if (!succeeded) throw new Error("All RSS requests failed; do not publish this refresh.");
  console.log(`Static feeds generated in ${outputRoot}`);
}

export async function fetchArticlesForFeed(country, feedConfig) {
  const locale = localeForCountry(country.id);
  const query = feedConfig.query({ countryName: country.name, countryCode: country.id });
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", locale.hl);
  url.searchParams.set("gl", locale.gl);
  url.searchParams.set("ceid", locale.ceid);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      "user-agent": "LatamDigestStaticFeedGenerator/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`RSS request failed with ${response.status}`);
  }

  const xml = await response.text();
  if (xml.length > 2_000_000 || /<!DOCTYPE/i.test(xml)) throw new Error("Unexpected RSS content.");
  const parsed = parser.parse(xml);
  let items = parsed?.rss?.channel?.item ?? [];

  if (!Array.isArray(items)) {
    items = items ? [items] : [];
  }

  const deduped = new Map();

  for (const item of items) {
    const article = toArticle(item, country, feedConfig);

    if (!article) {
      continue;
    }

    const dedupeKey = `${article.title.toLowerCase()}|${article.sourceName.toLowerCase()}`;
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, article);
    }

    if (deduped.size >= 12) {
      break;
    }
  }

  return Array.from(deduped.values()).sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt)
  );
}

export function toArticle(item, country, feedConfig) {
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
  const source =
    typeof sourceNode === "string"
      ? sourceNode
      : sourceNode?.["#text"] || sourceNode?.text || null;

  if (source?.trim()) {
    return source.trim();
  }

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
