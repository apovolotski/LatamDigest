import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { createDigestStore } from '../src/digestStore.js';
import { articleID, isWebURL } from '../src/articleIdentity.js';
import { toArticles } from '../src/articleMapper.js';
import { generateFeeds, toArticle } from '../scripts/generate-static-feeds.mjs';

const article = { id: articleID('https://example.com/story'), title: 'Election news', url: 'https://example.com/story', sourceName: 'Example', publishedAt: '2026-10-07T12:00:00.000Z' };
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
test('concurrent refreshes generate once, failures preserve last successful digest', async () => {
  let calls = 0;
  let fail = false;
  const store = createDigestStore({ generate: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); if (fail) throw Error('provider-secret'); return digest; } });
  const results = await Promise.all([store.getDigest('MX'), store.getDigest('mx')]);
  assert.equal(calls, 1);
  assert.deepEqual(results, [digest, digest]);
  fail = true;
  await assert.rejects(store.getDigest('MX', { forceRefresh: true }));
  assert.equal(store.getCachedDigest('MX'), digest);
  fail = false;
  await store.getDigest('MX', { forceRefresh: true });
  assert.equal(calls, 3);
});
test('public routes cannot request paid refresh and do not leak provider errors', async () => {
  const server = createApp({ readDigest: code => code === 'BR' ? null : digest }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const endpoint of ['/digests/MX?refresh=true', '/countries/MX/top?refresh=true', '/countries/MX/latest?refresh=true', '/countries/MX/category/politics?refresh=true']) {
      assert.equal((await fetch(base + endpoint)).status, 403);
    }
    assert.equal((await fetch(base + '/countries/ZZ/top')).status, 404);
    assert.equal((await fetch(base + '/countries/BR/top')).status, 503);
    const response = await fetch(base + '/countries/MX/top');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal((await response.json())[0].url, article.url);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('static refresh retains successful feed and original timestamp after upstream failure', async () => {
  const destination = await mkdtemp(path.join(tmpdir(), 'latam-test-'));
  const options = { countries: [{ id: 'MX', name: 'Mexico' }], destination, feeds: [{ key: 'top', label: 'Top' }] };
  try {
    const first = await generateFeeds({ ...options, fetchFeed: async () => [article] });
    const second = await generateFeeds({ ...options, fetchFeed: async () => { throw Error('upstream failure'); } });
    assert.equal(second.succeeded, 0);
    assert.equal(second.manifest.countries[0].feeds.top.stale, true);
    assert.equal(second.manifest.countries[0].feeds.top.updatedAt, first.manifest.countries[0].feeds.top.updatedAt);
    assert.deepEqual(JSON.parse(await readFile(path.join(destination, 'countries/MX/top.json'))), [article]);
  } finally { await rm(destination, { recursive: true, force: true }); }
});
