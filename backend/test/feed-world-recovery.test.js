import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { feedConfigs, searchPlans, isRelevantArticle } from "../src/feedSearch.js";
import { fetchArticlesForFeed, generateFeeds, toArticle } from "../scripts/generate-static-feeds.mjs";
import { refreshFeeds } from "../scripts/refresh-static-feeds.mjs";
import { checkCoverage } from "../scripts/check-feed-coverage.mjs";

const country = { id: "PR", name: "Puerto Rico" };
const world = feedConfigs.find(f => f.key === "world");
const title = "United States calls for ending UN decolonization committee, citing Puerto Rico hearings";
const article = (headline, daysAgo = 1) => toArticle({ title: headline,
  link: `https://example.com/${encodeURIComponent(headline)}`, source: "Example",
  pubDate: new Date(Date.now() - daysAgo * 86_400_000).toISOString() }, country, world);
const rss = articles => `<rss><channel>${articles.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
const old = () => article("La embajada de Trump interrogó a Colau por la flotilla antes de impedirle viajar a Puerto Rico", 13.2);

test("incident 41615295227: Puerto Rico's English fallback finds UN hearings after its only story ages out", async () => {
  const current = { ...article(title, 10), sourceName: "Pasquines" }, requests = [];
  const result = await fetchArticlesForFeed(country, world, { fetchImpl: async url => {
    requests.push(url);
    return new Response(rss(requests.length < 3 ? [old()] : [current,
      article(title.replace("Puerto Rico", "Guam")), article(title, 15), article(title, -2),
      article("Puerto Rico hosts an international football tournament"),
      article("Puerto Rico discusses decolonization of its school curriculum"),
      article("Puerto Rico inaugura un museo")]));
  } });
  assert.equal(requests.length, 3);
  assert.match(requests[2].searchParams.get("q"), /"Puerto Rico".*"decolonization".*when:14d/);
  assert.equal(requests[2].searchParams.get("ceid"), "US:en");
  assert.deepEqual(result.map(a => a.title), [title]);
  assert.equal(result[0].publishedAt, current.publishedAt);
  assert.equal(result[0].id, current.id);
  assert.equal(result[0].url, current.url);
  assert.equal(result.coverage.searches, 3);
  assert.equal(searchPlans({ id: "GY", name: "Guyana" }, world)[0].query.includes('"CARICOM"'), true);
});

test("the named UN decolonization committee keeps country, category and date boundaries", () => {
  const plan = { lookbackDays: 14 };
  for (const spelling of ["decolonization", "decolonisation"]) {
    assert.equal(isRelevantArticle(article(title.replace("decolonization", spelling)), country, world, plan), true);
  }
  for (const headline of ["Puerto Rico discusses decolonization of its school curriculum",
    "Puerto Rico inaugura un museo", "UN decolonization committee considers Guam hearings",
    "Puerto Rico hosts an international football tournament"]) {
    assert.equal(isRelevantArticle(article(headline), country, world, plan), false, headline);
  }
  for (const days of [15, -2]) assert.equal(isRelevantArticle(article(title, days), country, world, plan), false);
  assert.equal(isRelevantArticle(article(title), country, feedConfigs.find(f => f.key === "tech"), plan), false);
});

test("the world fallback replaces aging cache atomically and preserves original dates in partial recovery", async t => {
  const folder = await mkdtemp(path.join(tmpdir(), "latam-world-recovery-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const options = { destination: path.join(folder, "api"), countries: [country], summaryFile: path.join(folder, "summary.md") };
  const generic = () => article("Puerto Rico: economía, política, empresas, deportes, tecnología, cultura, crimen y diplomacia");
  await generateFeeds({ ...options, fetchFeed: async () => [generic()] });
  const file = path.join(options.destination, "countries/PR/category/world.json");
  await writeFile(file, JSON.stringify([old()]));
  const before = await readFile(file, "utf8");
  await assert.rejects(refreshFeeds({ ...options, generate: o => generateFeeds({ ...o,
    fetchFeed: async (_, f) => f.key === "world" ? [] : [generic()]
  }) }), /PR\/world: empty feed/);
  assert.equal(await readFile(file, "utf8"), before);
  const current = article(title, 10);
  let searches = 0;
  const status = await refreshFeeds({ ...options, generate: o => generateFeeds({ ...o,
    fetchFeed: (c, f) => f.key !== "world" ? Promise.resolve([generic()]) : fetchArticlesForFeed(c, f, {
      fetchImpl: async () => new Response(rss(++searches < 3 ? [old()] : [current]))
    })
  }) });
  assert.equal(searches, 3);
  assert.equal(status.state, "healthy");
  assert.equal(status.refreshedFeeds, 10);
  assert.equal(status.cachedFeeds, 0);
  const articles = JSON.parse(await readFile(file));
  assert.deepEqual(articles, [current]);
  const original = JSON.parse(await readFile(path.join(options.destination, "manifest.json"))).countries[0].feeds.world;
  const retained = await refreshFeeds({ ...options, generate: o => generateFeeds({ ...o,
    fetchFeed: async (_, f) => f.key === "world" ? [] : [generic()]
  }) });
  assert.equal(retained.state, "degraded");
  assert.equal(retained.cachedFeeds, 1);
  assert.deepEqual(JSON.parse(await readFile(file)), articles);
  const cached = JSON.parse(await readFile(path.join(options.destination, "manifest.json"))).countries[0].feeds.world;
  assert.equal(cached.updatedAt, original.updatedAt);
  assert.equal(cached.stale, true);
  assert.deepEqual((await checkCoverage(options)).issues, []);
});
