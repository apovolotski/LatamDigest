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
const article = (title, sourceName) => ({ title, sourceName,
  url: `https://example.com/${encodeURIComponent(title)}`, publishedAt: new Date(Date.now() - 3600_000).toISOString() });
const relevant = (id, key, title, source) => isRelevantArticle(article(title, source), country(id), feed(key), { lookbackDays: 14 });
const score = "Litouwen vs. Suriname - Voetbal Wedstrijd Samenvatting - 12 november 2026";
const pairing = "Litouwen v Suriname";
const catalogue = "À toi qui viens d'apprendre - les replays et vidéos en streaming - Guyane La 1ère - Outre-mer La 1ère";
const visit = "Que fait Judith González en Guyane ? L'actrice cubaine révèle le motif de son voyage";
const cases = [
  ["SR", "sports", score, "ESPN.nl", "Suriname wint een voetbalwedstrijd"],
  ["SR", "top", pairing, "Voetbalzone", "Suriname kiest nieuwe bondscoach"],
  ["GF", "top", catalogue, "Outre-mer La 1ère", "Guyane présente son journal télévisé"],
  ["GF", "top", visit, "CiberCuba", "Une actrice cubaine visite Cayenne en Guyane française"]
];

test("Dutch score templates and the observed bare pairing are not dated news", () => {
  for (const key of ["top", "latest", "sports"]) assert.equal(relevant("SR", key, score, "ESPN.nl"), false);
  for (const key of ["top", "latest"]) assert.equal(relevant("SR", key, pairing, "Voetbalzone"), false);
  assert.equal(relevant("SR", "sports", "Suriname bereidt voetbalwedstrijd tegen Litouwen voor", "ESPN.nl"), true);
  assert.equal(relevant("SR", "sports", "Litouwen v Suriname: bondscoach bespreekt voetbalvoorbereiding", "Voetbalzone"), true);
  assert.equal(relevant("SR", "sports", "Suriname wint voetbalwedstrijd: samenvatting van de zege", "ESPN.nl"), true);
});

test("replay catalogues are excluded while dated broadcasts and programme reporting remain", () => {
  for (const source of ["Outre-mer La 1ère", "France TV"]) {
    for (const key of ["top", "latest"]) assert.equal(relevant("GF", key, catalogue, source), false);
    assert.equal(relevant("GF", "top", "Émission du mardi 03 novembre 2026 en replay - 13h en Guyane", source), true);
    assert.equal(relevant("GF", "top", "Guyane : une nouvelle émission raconte les parcours des habitants", source), true);
    assert.equal(relevant("GF", "top", "Guyane développe les replays et vidéos en streaming de ses journaux", source), true);
  }
});

test("the reviewed Guyana visit needs independent French Guiana evidence", () => {
  for (const key of ["top", "latest", "culture"]) assert.equal(relevant("GF", key, visit, "CiberCuba"), false);
  assert.equal(relevant("GF", "top", `${visit} Rencontre à Cayenne`, "CiberCuba"), true);
  assert.equal(relevant("GF", "top", "Judith González visite la Guyane française", "CiberCuba"), true);
  assert.equal(relevant("GY", "top", "Judith González visits Guyana to meet Cuban migrants", "CiberCuba"), true);
  assert.equal(relevant("CU", "top", "La actriz cubana Judith González visita Guyana", "CiberCuba"), true);
  assert.equal(relevant("GF", "top", "Une actrice cubaine visite la Guyane", "CiberCuba"), true);
});

test("live selection replaces the observed catalogue and geography defects without changing dates", async () => {
  for (const [id, key, bad, source, good] of cases) {
    const items = [article(bad, source), article(good, source)];
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const selected = await fetchArticlesForFeed(country(id), feed(key), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(selected.map(a => a.title), [good], bad);
    assert.equal(selected[0].publishedAt, items[1].publishedAt);
  }
});

test("cached recovery rejects the same defects rather than renewing bad entries", async t => {
  for (const [id, key, bad, source] of cases) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-catalogue-cache-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const alternate = key === "top" ? "latest" : "top";
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed(alternate)] };
    await generateFeeds({ ...options, fetchFeed: async () => [article(bad, source)] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [article(`${country(id).name} news`, "Example")] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0, bad);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null, bad);
  }
});
