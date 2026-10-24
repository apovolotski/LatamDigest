import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { articleID, isWebURL } from '../src/articleIdentity.js';
import { toArticles } from '../src/articleMapper.js';
import { FeedRequestError } from '../src/rssClient.js';
import { generateFeeds, toArticle } from '../scripts/generate-static-feeds.mjs';

const article = { id: articleID('https://example.com/story'), title: 'Election news', url: 'https://example.com/story', sourceName: 'Example', publishedAt: new Date(Date.now() - 3600_000).toISOString() };
const story = { headline: article.title, source_url: article.url, source_name: article.sourceName, category: 'politics', summary: 'Summary', why_it_matters: 'Impact' };
const digest = { generated_at: article.publishedAt, stories: [story] };

test('browser links reject script, local file, and embedded credentials', () => {
  for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:password@example.com', 'not-a-url']) assert.equal(isWebURL(value), false);
  assert.equal(isWebURL(article.url), true);
});
test('feed and backend articles keep stable IDs across refreshes', () => {
  assert.equal(toArticles(digest)[0].id, toArticles(digest)[0].id);
  const item = { title: 'Election news - Example', link: article.url, source: 'Example', pubDate: article.publishedAt };
  const rss = toArticle(item, { name: 'Mexico' }, { label: 'Top' });
  assert.equal(rss.id, toArticles(digest)[0].id);
  assert.equal(rss.title, 'Election news');
  assert.equal(toArticle({ ...item, pubDate: 'invalid' }, { name: 'Mexico' }, { label: 'Top' }), null);
  assert.equal(toArticle({ ...item, link: 'javascript:alert(1)' }, { name: 'Mexico' }, { label: 'Top' }), null);
});
test('unsafe generated story URLs are omitted', () => {
  assert.equal(toArticles({ ...digest, stories: [{ ...story, source_url: 'file:///secret' }] }).length, 0);
});
test('static refresh retains successful feed and original timestamp after upstream failure', async () => {
  const destination = await mkdtemp(path.join(tmpdir(), 'latam-test-'));
  const options = { countries: [{ id: 'MX', name: 'Mexico' }], destination, feeds: [{ key: 'top', label: 'Top' }] };
  try {
    const first = await generateFeeds({ ...options, fetchFeed: async () => [article] });
    const second = await generateFeeds({ ...options, fetchFeed: async () => { throw new FeedRequestError('network', { retryable: true }); } });
    assert.equal(second.succeeded, 0);
    assert.equal(second.manifest.countries[0].feeds.top.stale, true);
    assert.equal(second.manifest.countries[0].feeds.top.updatedAt, first.manifest.countries[0].feeds.top.updatedAt);
    assert.deepEqual(JSON.parse(await readFile(path.join(destination, 'countries/MX/top.json'))), [article]);
  } finally { await rm(destination, { recursive: true, force: true }); }
});
