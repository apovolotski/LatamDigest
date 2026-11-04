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
const agency = "Initiative Argentina: “Effie es una cultura dentro de la agencia y para con los clientes”";
const vehicle = "De una camioneta Fiat a “una obra de arte”: cómo se construyó en Uruguay el papamóvil que usará León XIV";
const congress = "Uruguay será sede del VII Congreso Mundial de Ingenieros Agrónomos";
const cases = [
  ["AR", "culture", agency, "Argentina presenta una exposición de arte", "Marketers by Adlatina"],
  ["UY", "culture", vehicle, "Uruguay presenta un concierto de música", "La Mañana"],
  ["UY", "politics", congress, "Uruguay celebra elecciones parlamentarias", "El Eco Digital"]
];
const article = title => ({ title, sourceName: "Example News", url: `https://example.com/${encodeURIComponent(title)}`,
  publishedAt: new Date(Date.now() - 3600_000).toISOString() });
const relevant = (id, key, title) => isRelevantArticle(article(title), country(id), feed(key), { lookbackDays: 14 });

test("an agency's workplace culture needs independent arts evidence", () => {
  assert.equal(relevant("AR", "culture", agency), false);
  assert.equal(relevant("AR", "culture", "Argentina: la cultura Effie impulsa resultados comerciales"), false);
  assert.equal(relevant("AR", "culture", `${agency}: una exposición de arte`), true);
  assert.equal(relevant("AR", "culture", "Argentina: agencia de cultura presenta sus museos"), true);
  assert.equal(relevant("AR", "top", agency), true);
  assert.equal(relevant("AR", "business", `${agency}: nuevos negocios`), true);
});

test("a papamóvil described as a work of art needs separate arts evidence", () => {
  assert.equal(relevant("UY", "culture", vehicle), false);
  assert.equal(relevant("UY", "culture", `${vehicle}: exposición artística en un museo`), true);
  assert.equal(relevant("UY", "culture", "Uruguay: artistas pintan un papamóvil"), true);
  assert.equal(relevant("UY", "culture", "Uruguay presenta una obra de arte en un museo"), true);
  assert.equal(relevant("UY", "top", vehicle), true);
});

test("an agronomists' world congress is not legislative evidence", () => {
  assert.equal(relevant("UY", "politics", congress), false);
  assert.equal(relevant("UY", "politics", "Uruguay anuncia el Congreso Mundial de Ingenieros Agrónomos"), false);
  assert.equal(relevant("UY", "politics", `${congress}: el presidente anuncia una nueva ley`), true);
  assert.equal(relevant("UY", "politics", "Uruguay: el Congreso vota una nueva ley"), true);
  assert.equal(relevant("UY", "politics", "Uruguay participa en un congreso mundial de partidos políticos"), true);
  assert.equal(relevant("UY", "top", congress), true);
});

test("live selection rejects contextual false positives and retains original news dates", async () => {
  for (const [id, key, rejected, replacement, sourceName] of cases) {
    const items = [rejected, replacement].map(title => ({ ...article(title), sourceName }));
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const selected = await fetchArticlesForFeed(country(id), feed(key), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(selected.map(a => a.title), [replacement]);
    assert.equal(selected[0].publishedAt, items[1].publishedAt);
    assert.equal(isRelevantArticle({ ...items[1], publishedAt: new Date(Date.now() - 15 * 86400_000).toISOString() }, country(id), feed(key), { lookbackDays: 14 }), false);
    assert.equal(isRelevantArticle(items[1], country("PY"), feed(key), { lookbackDays: 14 }), false);
  }
});

test("cached recovery rejects the same contextual errors without renewing timestamps", async t => {
  for (const [id, key, rejected, replacement, sourceName] of cases) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-professional-context-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [{ ...article(rejected), sourceName }] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [{ ...article(replacement), sourceName }] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null);
  }
});
