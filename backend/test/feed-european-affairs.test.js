import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { feedConfigs, searchPlans, isRelevantArticle } from "../src/feedSearch.js";
import { fetchArticlesForFeed, generateFeeds } from "../scripts/generate-static-feeds.mjs";
const country = { id: "GF", name: "French Guiana" };
const world = feedConfigs.find(f => f.key === "world");
const title = "Le vice-président exécutif de la Commission européenne Raffaele Fitto en visite en Guadeloupe, à Saint-Martin, en Martinique et en Guyane pour discuter de la politique de cohésion et de la stratégie de l’UE en faveur des RUP";
const story = (headline, days = 0) => ({ title: headline, url: `https://example.com/${encodeURIComponent(headline)}`, sourceName: "Outremers360", publishedAt: new Date(Date.now() - days * 86400000).toISOString() });
const rss = articles => `<rss><channel>${articles.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;

test("incident 43212001512: French Guiana's bounded fallback finds European affairs before the singleton expires", async () => {
  const current = story(title, 8), old = story("La coopération entre la Guyane et le Brésil reste fragile malgré la victoire de Lula", 13.3), calls = [];
  const result = await fetchArticlesForFeed(country, world, { fetchImpl: async url => {
    calls.push(url.searchParams.get("q"));
    return new Response(rss(calls.length === 2 ? [current, old, story(title, 15), story("Commission européenne en visite en Belgique"), story("Festival de musique européenne en Guyane")] : [old]));
  }});
  assert.equal(calls.length, 3);
  assert.match(calls[1], /^"Guyane" /);
  assert.match(calls[1], /"Union européenne"/);
  assert.match(calls[1], /when:14d$/);
  assert.deepEqual(result.map(a => [a.title, a.publishedAt]), [[current.title, current.publishedAt]]);
  assert.equal(result.coverage.searches, 3);
});

test("European Commission affairs require independent country evidence and retain date/category boundaries", () => {
  const plan = { lookbackDays: 14 };
  assert.equal(isRelevantArticle(story(title), country, world, plan), true);
  for (const headline of ["La Commission européenne en visite en Belgique", "Guyane : une commission municipale examine les écoles", "Guyane : festival de musique européenne", "Guyane accueille un tournoi européen de tennis"]) {
    assert.equal(isRelevantArticle(story(headline), country, world, plan), false, headline);
  }
  for (const days of [15, -2]) assert.equal(isRelevantArticle(story(title, days), country, world, plan), false);
  assert.equal(isRelevantArticle(story(title), country, feedConfigs.find(f => f.key === "culture"), plan), false);
  assert.equal(searchPlans(country, world).length, 3);
});

test("European affairs replacement and partial cache recovery preserve article dates and feed timestamps", async t => {
  const destination = await mkdtemp(path.join(tmpdir(), "latam-eu-cache-"));
  t.after(() => rm(destination, { recursive: true, force: true }));
  const top = feedConfigs.find(f => f.key === "top"), current = story(title, 8);
  await generateFeeds({ destination, countries: [country], feeds: [world, top], fetchFeed: async () => [story("La coopération entre la Guyane et le Brésil reste fragile", 13.3)] });
  await generateFeeds({ destination, countries: [country], feeds: [world, top], fetchFeed: async (_, f) => [f.key === "world" ? current : story("Guyane ouvre une école")] });
  const file = path.join(destination, "countries/GF/category/world.json"), bytes = await readFile(file, "utf8");
  const before = JSON.parse(await readFile(path.join(destination, "manifest.json")));
  await generateFeeds({ destination, countries: [country], feeds: [world, top], fetchFeed: async (_, f) => f.key === "world" ? [] : [story("Guyane ouvre une école")] });
  const after = JSON.parse(await readFile(path.join(destination, "manifest.json")));
  assert.equal(await readFile(file, "utf8"), bytes);
  assert.equal(JSON.parse(bytes)[0].publishedAt, current.publishedAt);
  assert.equal(after.countries[0].feeds.world.updatedAt, before.countries[0].feeds.world.updatedAt);
  assert.equal(after.countries[0].feeds.world.stale, true);
});
