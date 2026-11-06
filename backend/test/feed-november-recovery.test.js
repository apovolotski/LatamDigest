import test from 'node:test';
import assert from 'node:assert/strict';
import { feedConfigs, searchPlans, isRelevantArticle } from '../src/feedSearch.js';
import { fetchArticlesForFeed, toArticle } from '../scripts/generate-static-feeds.mjs';
const pr = { id: 'PR', name: 'Puerto Rico' }, sr = { id: 'SR', name: 'Suriname' };
const world = feedConfigs.find(f => f.key === 'world'), sports = feedConfigs.find(f => f.key === 'sports');
const military = 'Puerto Rico: Posible base de apoyo para una intervención militar de EE.UU. en Cuba, revela senador boricua';
const goalkeeper = 'FC Groningen doelman Etienne Vaessen mag vier wedstrijden niet voor Suriname spelen wegens schorsing';
const make = (title, country, feed, days = 1, source = 'Example') => toArticle({ title, source,
  link: `https://example.com/${encodeURIComponent(title)}`,
  pubDate: new Date(Date.now() - days * 86400000).toISOString() }, country, feed);
const relevant = (title, c, f, days = 1) => isRelevantArticle(make(title, c, f, days), c, f, { lookbackDays: 14 });

test('Dutch national goalkeeper and international-match reporting retain sports and country boundaries', () => {
  for (const title of [goalkeeper, 'Suriname-keeper Vaessen hard gestraft', 'Surinaamse doelvrouw maakt debuut', 'Concacaf schorst speler na interland Suriname']) assert.equal(relevant(title, sr, sports), true, title);
  for (const title of ['Nederlandse doelman maakt debuut', 'Suriname organiseert een politieke bijeenkomst', 'Suriname bespreekt diplomatieke samenwerking']) assert.equal(relevant(title, sr, sports), false, title);
  assert.equal(relevant(goalkeeper, sr, world), false);
  for (const days of [15, -2]) assert.equal(relevant(goalkeeper, sr, sports, days), false);
  const plans = searchPlans(sr, sports);
  assert.equal(plans.length, 3);
  assert.match(plans[1].query, /"Suriname".*"doelman".*when:14d/);
});

test('Spanish military affairs require foreign context and preserve category and date gates', () => {
  for (const title of [military, 'Puerto Rico podría servir como base de apoyo militar ante posible intervención en Cuba']) assert.equal(relevant(title, pr, world), true, title);
  for (const title of ['Puerto Rico recibe apoyo militar tras inundaciones', 'Puerto Rico organiza una intervención militar local', 'Puerto Rico presenta una banda militar de Cuba', 'Puerto Rico celebra un torneo con Cuba', 'Cuba recibe apoyo militar de Rusia']) assert.equal(relevant(title, pr, world), false, title);
  assert.equal(relevant(military, pr, sports), false);
  for (const days of [15, -2]) assert.equal(relevant(military, pr, world, days), false);
  const plans = searchPlans(pr, world);
  assert.equal(plans.length, 3);
  assert.match(plans[1].query, /"Puerto Rico".*"intervención militar".*when:14d/);
});

test('both sparse searches replace an aging singleton without changing article dates, URLs or IDs', async () => {
  for (const [country, feed, title] of [[pr, world, military], [sr, sports, goalkeeper]]) {
    const current = make(title, country, feed, 6), old = make(title, country, feed, 13.2);
    let calls = 0;
    const result = await fetchArticlesForFeed(country, feed, { fetchImpl: async () => {
      const items = ++calls === 2 ? [current, old, make(title, country, feed, -2)] : [old];
      return new Response(`<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join('')}</channel></rss>`);
    }});
    assert.deepEqual([...result], [current]);
    assert.equal(calls, 3);
    // Cached recovery calls the same predicate; it cannot retain expired articles.
    assert.equal(isRelevantArticle(current, country, feed, { lookbackDays: 13 }), true);
    assert.equal(isRelevantArticle(old, country, feed, { lookbackDays: 13 }), false);
  }
});

test('the exact October 15 Anglada interview cannot be renewed through November syndication', () => {
  const title = 'Rafael Anglada: “En el tema del colonialismo, Puerto Rico y Malvinas hemos vivido como gemelos”';
  for (const source of ['NR', 'Nueva Revolución', 'RealPolitik']) {
    for (const feed of [world, feedConfigs[0]]) assert.equal(isRelevantArticle(make(title, pr, feed, 1, source), pr, feed, { lookbackDays: 14 }), false);
    assert.equal(isRelevantArticle(make('Rafael Anglada analiza nuevas relaciones internacionales de Puerto Rico', pr, world, 1, source), pr, world, { lookbackDays: 14 }), true);
  }
});
