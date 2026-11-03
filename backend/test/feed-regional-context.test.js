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
const relevant = (id, key, title) => isRelevantArticle(article(title), country(id), feed(key), { lookbackDays: 14 });
const political = "The political culture T&T can no longer afford";
const treaty = "If CCJ can settle Caricom dispute, why not make it T&T’s final court?";
const misiones = "Crimen de “Manito” Britez en Puerto Rico: confirmaron la prisión preventiva de los dos acusados";
const cases = [
  ["TT", "culture", political, "Trinidad Guardian", "Tobago hosts a music concert"],
  ["TT", "crime", treaty, "Trinidad Guardian", "Trinidad police investigate a murder"],
  ["PR", "crime", misiones, "MisionesOnline", "Puerto Rico investiga un homicidio"]
];

test("political culture needs independent arts evidence in all supported languages", () => {
  for (const [id, title] of [["TT", political], ["AR", "La cultura política de Argentina"],
    ["BR", "A cultura política do Brasil"], ["GF", "La culture politique en Guyane"], ["SR", "De politieke cultuur van Suriname"]]) {
    assert.equal(relevant(id, "culture", title), false, title);
    assert.equal(relevant(id, "culture", `${title}: music concert`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
  assert.equal(relevant("TT", "culture", "Tobago artists discuss political culture through music"), true);
});

test("CARICOM treaty disputes need independent criminal evidence for crime placement", () => {
  assert.equal(relevant("TT", "crime", treaty), false);
  assert.equal(relevant("TT", "top", treaty), true);
  assert.equal(relevant("TT", "crime", `${treaty} Court hears a murder appeal`), true);
  assert.equal(relevant("TT", "crime", "Tobago court hears a murder case"), true);
  assert.equal(relevant("TT", "crime", "T&T: Caribbean Court of Justice hears CARICOM dispute"), false);
});

test("Puerto Rico in the reviewed Misiones case needs independent Puerto Rican evidence", () => {
  for (const title of [misiones, "Puerto Rico, Misiones: policía investiga un homicidio",
    "Policía de Misiones investiga un asesinato en Puerto Rico"]) {
    for (const key of ["top", "latest", "crime"]) assert.equal(relevant("PR", key, title), false, title);
    assert.equal(relevant("PR", "crime", `${title}: familia puertorriqueña pide justicia`), true, title);
  }
  assert.equal(relevant("PR", "crime", "Puerto Rico investiga un homicidio"), true);
  assert.equal(relevant("PR", "world", "Puerto Rico impulsa misiones de cooperación internacional"), true);
  assert.equal(relevant("AR", "crime", `${misiones}, en Argentina`), true);
});

test("live selection rejects regional context errors and preserves replacement dates", async () => {
  for (const [id, key, bad, source, good] of cases) {
    const items = [article(bad, source), article(good)];
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title.replaceAll("&", "&amp;")}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const selected = await fetchArticlesForFeed(country(id), feed(key), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(selected.map(a => a.title), [good], bad);
    assert.equal(selected[0].publishedAt, items[1].publishedAt);
  }
});

test("cached recovery rejects the same regional context errors without renewing timestamps", async t => {
  for (const [id, key, bad, source] of cases) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-regional-cache-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [article(bad, source)] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [article(`${country(id).name} news`)] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0, bad);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null, bad);
  }
});
