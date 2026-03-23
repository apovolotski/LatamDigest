import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const countries = JSON.parse(await fs.readFile(countriesPath, "utf8"));

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

await writeJson(path.join(outputRoot, "countries.json"), countries);

const manifest = {
  generatedAt: new Date().toISOString(),
  source: "Google News RSS",
  feeds: feedConfigs.map(({ key, label }) => ({ key, label })),
  countries: []
};

for (const country of countries) {
  const countryDir = path.join(outputRoot, "countries", country.id);
  await fs.mkdir(path.join(countryDir, "category"), { recursive: true });

  const countryManifest = {
    id: country.id,
    name: country.name,
    feeds: {}
  };

  for (const feedConfig of feedConfigs) {
    try {
      const articles = await fetchArticlesForFeed(country, feedConfig);
      const relativePath =
        feedConfig.key === "top" || feedConfig.key === "latest"
          ? path.join(countryDir, `${feedConfig.key}.json`)
          : path.join(countryDir, "category", `${feedConfig.key}.json`);

      await writeJson(relativePath, articles);

      countryManifest.feeds[feedConfig.key] = {
        count: articles.length,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed generating ${country.id}/${feedConfig.key}: ${error.message}`);
      const relativePath =
        feedConfig.key === "top" || feedConfig.key === "latest"
          ? path.join(countryDir, `${feedConfig.key}.json`)
          : path.join(countryDir, "category", `${feedConfig.key}.json`);

      await writeJson(relativePath, []);
      countryManifest.feeds[feedConfig.key] = {
        count: 0,
        updatedAt: new Date().toISOString(),
        error: error.message
      };
    }
  }

  manifest.countries.push(countryManifest);
}

await writeJson(path.join(outputRoot, "manifest.json"), manifest);

console.log(`Static feeds generated in ${outputRoot}`);

async function fetchArticlesForFeed(country, feedConfig) {
  const locale = localeForCountry(country.id);
  const query = feedConfig.query({ countryName: country.name, countryCode: country.id });
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", locale.hl);
  url.searchParams.set("gl", locale.gl);
  url.searchParams.set("ceid", locale.ceid);

  const response = await fetch(url, {
    headers: {
      "user-agent": "LatamDigestStaticFeedGenerator/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`RSS request failed with ${response.status}`);
  }

  const xml = await response.text();
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

function toArticle(item, country, feedConfig) {
  const rawTitle = text(item.title);
  const sourceName = normalizeSourceName(item.source, rawTitle);
  const title = stripSourceSuffix(rawTitle, sourceName);
  const url = text(item.link);

  if (!title || !url) {
    return null;
  }

  const publishedAt = normalizeDate(item.pubDate);
  const snippet = buildSnippet(country, feedConfig, sourceName);
  const id = crypto.randomUUID();

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
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
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
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}
