import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server.js';
import { createDigestStore } from '../../src/digestStore.js';
import { articleID } from '../../src/articleIdentity.js';
import qs from 'qs';

const article = { id: articleID('https://example.com/story'), title: 'Election news', url: 'https://example.com/story', sourceName: 'Example', publishedAt: new Date(Date.now() - 3600_000).toISOString() };
const story = { headline: article.title, source_url: article.url, source_name: article.sourceName, category: 'politics', summary: 'Summary', why_it_matters: 'Impact' };
const digest = { generated_at: article.publishedAt, stories: [story] };

test('incident 40729599050: hostile query values cannot crash comma serialization', () => {
  for (const input of [{ a: [{ toString: 'x' }] }, qs.parse('a[0][toString]=x', { allowPrototypes: true }), qs.parse('a[][b]=c', { plainObjects: true })]) {
    for (const encodeValuesOnly of [false, true]) {
      assert.doesNotThrow(() => qs.stringify(input, { arrayFormat: 'comma', encodeValuesOnly }));
    }
  }
  assert.equal(qs.stringify({ a: ['one', 'two'] }, { arrayFormat: 'comma' }), 'a=one%2Ctwo');
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
