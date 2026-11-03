import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { feedConfigs, isRelevantArticle } from "../src/feedSearch.js";
import { fetchArticlesForFeed, generateFeeds } from "../scripts/generate-static-feeds.mjs";

const countries = JSON.parse(await readFile(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url)));
const country = id => countries.find(c => c.id === id);
const feed = key => feedConfigs.find(f => f.key === key);
const article = (title, sourceName = "Example") => ({ title, sourceName,
  url: `https://example.com/${encodeURIComponent(title)}`, publishedAt: new Date(Date.now() - 3600_000).toISOString() });
const relevant = (id, key, title, source) => isRelevantArticle(article(title, source), country(id), feed(key), { lookbackDays: 14 });
const football = "“Se sacaron chispas en Perú”, la cruda reacción de la prensa internacional tras altercado entre Hernán Barcos y Pablo Guede";
const archive = "Colombia, Chile y Ecuador fortalecen la Cooperación Internacional en la Antártica";
const current = "Colombia y Ecuador fortalecen la cooperación marítima y amplían oportunidades para la gente de mar";
const publisher = "Portal Marítimo Colombiano - Dimar";
const cases = [
  ["PE", football, "Infobae", "Perú y Chile firman un acuerdo de cooperación bilateral"],
  ["CO", archive, publisher, "Colombia y Ecuador firman un acuerdo de cooperación bilateral"],
  ["CO", current, publisher, "Colombia y Ecuador firman un acuerdo de cooperación bilateral"]
];

test("foreign press coverage of the reviewed football dispute needs independent affairs evidence", () => {
  assert.equal(relevant("PE", "world", football, "Infobae"), false);
  assert.equal(relevant("PE", "top", football, "Infobae"), true);
  assert.equal(relevant("PE", "world", `${football}: embajada interviene en conflicto diplomático`), true);
  assert.equal(relevant("PE", "world", "Prensa internacional analiza la política exterior del Perú"), true);
  assert.equal(relevant("BR", "world", "Imprensa internacional repercute saída de Flávio Bolsonaro do Brasil"), true);
});

test("DIMAR crawl dates cannot substitute for its original publication dates", () => {
  // Publisher dates: Antarctic report 2026-02-23; maritime agreement 2026-10-23.
  // Both received the same later RSS date. Quarantine identities until original
  // dates can be verified in production, without assigning guessed replacements.
  for (const source of [publisher, "Portal Marítimo Colombiano", "DIMAR", "dimar.mil.co", "www.dimar.mil.co"]) {
    for (const title of [archive, current]) for (const key of ["top", "latest", "world"]) {
      assert.equal(relevant("CO", key, title, source), false, `${source}/${key}`);
    }
  }
  assert.equal(relevant("CO", "world", "Colombia y Ecuador firman un acuerdo de cooperación bilateral", "Independent publisher"), true);
  assert.equal(relevant("CO", "world", "Colombia y Ecuador firman un acuerdo de cooperación bilateral", "DIMAR Analysis Review"), true);
});

test("live selection rejects misdated publisher items and the sporting world placement", async () => {
  for (const [id, bad, source, good] of cases) {
    const items = [article(bad, source), article(good)];
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const selected = await fetchArticlesForFeed(country(id), feed("world"), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(selected.map(a => a.title), [good]);
    assert.equal(selected[0].publishedAt, items[1].publishedAt);
  }
});

test("cached recovery applies the same date-source and sports-context checks", async t => {
  for (const [id, bad, source] of cases) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-publisher-cache-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed("world"), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [article(bad, source)] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === "world" ? [] : [article(`${country(id).name} news`)] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds.world.count, 0);
    assert.equal(manifest.countries[0].feeds.world.updatedAt, null);
  }
});
