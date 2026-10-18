import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { feedConfigs, isRelevantArticle } from "../src/feedSearch.js";
import { articleID, isWebURL } from "../src/articleIdentity.js";

const root = fileURLToPath(new URL("../../docs/api", import.meta.url));
const countriesFile = fileURLToPath(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url));

export async function checkCoverage({ destination = root, countries, now = Date.now() } = {}) {
  countries ??= JSON.parse(await fs.readFile(countriesFile, "utf8"));
  const manifest = JSON.parse(await fs.readFile(path.join(destination, "manifest.json"), "utf8"));
  const issues = [];
  const warnings = [];
  const expectedIDs = countries.map(country => country.id).sort();
  const actualIDs = manifest.countries.map(country => country.id).sort();
  if (JSON.stringify(expectedIDs) !== JSON.stringify(actualIDs)) issues.push("Manifest country set differs from app country set.");
  let populated = 0;
  let stale = 0;
  let sparse = 0;
  let fallback = 0;
  for (const country of countries) {
    const entry = manifest.countries.find(item => item.id === country.id);
    if (JSON.stringify(Object.keys(entry?.feeds ?? {}).sort()) !== JSON.stringify(feedConfigs.map(feed => feed.key).sort())) {
      issues.push(`${country.id}: manifest category set differs from app feeds.`);
    }
    for (const feed of feedConfigs) {
      const label = `${country.id}/${feed.key}`;
      const status = entry?.feeds?.[feed.key];
      const file = path.join(destination, "countries", country.id,
        ...(["top", "latest"].includes(feed.key) ? [`${feed.key}.json`] : ["category", `${feed.key}.json`]));
      let articles;
      try { articles = JSON.parse(await fs.readFile(file, "utf8")); }
      catch { issues.push(`${label}: missing or unreadable feed.`); continue; }
      if (!Array.isArray(articles) || !articles.length) { issues.push(`${label}: empty feed.`); continue; }
      populated++;
      if (!status || status.count !== articles.length) issues.push(`${label}: manifest count mismatch.`);
      if (!status?.updatedAt || now - Date.parse(status.updatedAt) > 7 * 86_400_000 || !Number.isFinite(Date.parse(status.updatedAt))) {
        issues.push(`${label}: missing or expired refresh timestamp.`);
      }
      const seen = new Set();
      for (const article of articles) {
        if (!isWebURL(article.url) || article.id !== articleID(article.url) || !article.title || !article.sourceName ||
            !isRelevantArticle(article, country, feed, { lookbackDays: 14 }, now)) {
          issues.push(`${label}: invalid, outdated, or unrelated article.`);
        }
        if (seen.has(article.id)) issues.push(`${label}: duplicate article ID.`);
        seen.add(article.id);
      }
      if (status?.coverage?.fallbackUnavailable) warnings.push(`${label}: additional fallback search unavailable.`);
      if (status?.stale) { stale++; warnings.push(`${label}: serving recent cached articles.`); }
      if (articles.length < 3) { sparse++; warnings.push(`${label}: only ${articles.length} relevant articles.`); }
      if (status?.coverage?.fallbackUsed) fallback++;
    }
  }
  return { total: countries.length * feedConfigs.length, populated, stale, sparse, fallback, issues: [...new Set(issues)], warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkCoverage();
  console.log(`Coverage: ${report.populated}/${report.total} populated; ${report.stale} stale; ${report.sparse} sparse; ${report.fallback} used fallback.`);
  for (const warning of report.warnings) console.log(`::warning::${warning}`);
  for (const issue of report.issues) console.error(issue);
  if (report.issues.length) process.exitCode = 1;
}
