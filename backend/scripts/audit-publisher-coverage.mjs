import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFeedRequestContext, fetchPublisherArticles} from './generate-static-feeds.mjs';
import {feedConfigs} from '../src/feedSearch.js';
import {MAX_PUBLICATION_AGE_MS} from '../src/feedFreshness.js';
import {publisherSourcesFor} from '../src/publisherSources.js';

// Readiness is deliberately stricter than publication. A sparse but relevant
// feed remains supported; this diagnostic identifies where to research backups.
export function publisherReadiness(articles, now = Date.now()) {
  const publishers = [...new Set(articles.map(article => article.sourceName))];
  const headroom = publishers.map(name => ({name, hours: Math.max(...articles
    .filter(article => article.sourceName === name)
    .map(article => (Date.parse(article.publishedAt) + MAX_PUBLICATION_AGE_MS - now) / 3600000))}));
  const reasons = [];
  if (articles.length < 3) reasons.push('fewer_than_three_articles');
  if (publishers.length < 2) reasons.push('fewer_than_two_publishers');
  if (headroom.filter(publisher => publisher.hours >= 48).length < 2)
    reasons.push('less_than_two_publishers_with_48h_headroom');
  return {verifiedPublishers: publishers, headroom, thin: reasons.length > 0, reasons};
}

export async function auditPublisherCoverage(options = {}) {
  const countries = options.countries ?? JSON.parse(await fs.readFile(
    new URL('../../LatamDigest/Resources/Countries.json', import.meta.url), 'utf8'));
  const feeds = options.feeds ?? feedConfigs;
  const requestContext = createFeedRequestContext();
  const signal = options.signal ?? AbortSignal.timeout(30 * 60000);
  const report = {startedAt: new Date().toISOString(), scope: 'independent publishers only; no Google or feed cache',
    expected: countries.length * feeds.length, completed: 0, empty: [], thin: [], rows: []};
  let nextCountry = 0;
  await Promise.all(Array.from({length: Math.min(3, countries.length)}, async () => {
    while (nextCountry < countries.length) {
      const country = countries[nextCountry++];
      for (const feed of feeds) {
        signal.throwIfAborted();
        const articles = await (options.fetchPublisherArticles ?? fetchPublisherArticles)(country, feed,
          {requestContext, signal, minimumPublishers: 2, minimumHeadroomHours: 48, fetchImpl: options.fetchImpl});
        const key = `${country.id}/${feed.key}`;
        const readiness = publisherReadiness(articles);
        report.rows.push({country: country.id, feed: feed.key, checkedAt: new Date().toISOString(),
          configuredPublishers: new Set(publisherSourcesFor(country, feed).map(source => source.name)).size,
          ...readiness, articles});
        report.completed = report.rows.length;
        if (!articles.length) report.empty.push(key);
        if (readiness.thin) report.thin.push(key);
        report.checkedAt = new Date().toISOString();
        await options.onProgress?.(report, key);
      }
    }
  }));
  report.rows.sort((a, b) => `${a.country}/${a.feed}`.localeCompare(`${b.country}/${b.feed}`));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--output')
    throw new Error('Usage: node scripts/audit-publisher-coverage.mjs --output <report.json>');
  const output = path.resolve(args[1]);
  let pendingWrite = Promise.resolve();
  const report = await auditPublisherCoverage({onProgress: async (progress, key) => {
    const snapshot = JSON.stringify(progress, null, 2) + '\n';
    pendingWrite = pendingWrite.then(async () => {
      await fs.writeFile(output + '.tmp', snapshot);
      await fs.rename(output + '.tmp', output);
    });
    await pendingWrite;
    console.log(`${progress.completed}/${progress.expected} ${key}: ${progress.rows.at(-1).articles.length} articles, ${progress.rows.at(-1).verifiedPublishers.length} publishers`);
  }});
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Independent coverage: ${report.completed - report.empty.length}/${report.expected}; ${report.thin.length} need additional resilience review.`);
  if (report.empty.length) process.exitCode = 1;
}
