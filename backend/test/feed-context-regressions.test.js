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
const models = "Aeromodelismo en General Alvear: pilotos de Argentina, Chile y Uruguay participaron de un festival internacional";
const replicas = "EL FESTIVAL INTERNACIONAL DE RÉPLICAS REUNIÓ A PARTICIPANTES DE ARGENTINA, CHILE Y URUGUAY";
const chess = "Costa Rica recibe el XXI Festival Centroamericano y del Caribe de Ajedrez";
const anniversary = "Martín Perez participó del acto por el 205° aniversario de la Policía Federal Argentina";
const domestic = "Unimed Mercosul apresenta novo vídeo institucional e reforça a força da cooperação no Sul do Brasil";
const tracker = "Defensa y Justicia vs Independiente - En vivo Torneo Clausura - Liga Profesional de Argentina - 2026 - Fase Regular";
const cases = [
  ["AR", "culture", models, "Example", "Argentina inaugura un festival de música"],
  ["UY", "culture", replicas, "FM Viñas", "Uruguay inaugura un festival de música"],
  ["CR", "culture", chess, "Vos TV", "Costa Rica inaugura un festival de música"],
  ["AR", "crime", anniversary, "Diario El Sureño", "Argentina investiga un homicidio"],
  ["AR", "crime", "Defensa y Justicia vs Independiente: previa del torneo de Argentina", "Example", "Argentina investiga un homicidio"],
  ["BR", "world", domestic, "Unimed", "Brasil e Argentina ampliam cooperação em saúde"],
  ["AR", "latest", tracker, "Futbolargentino.com", "Argentina celebra una victoria en fútbol"]
];

test("aeromodelling and chess festivals need independent arts evidence", () => {
  for (const [id, title] of [["AR", models], ["UY", models], ["CL", replicas], ["UY", replicas], ["CR", chess],
    ["CU", "Cubanos a festival centroamericano juvenil de ajedrez en Costa Rica"],
    ["BR", "Brasil recebe festival de xadrez"], ["GF", "Guyane accueille un festival d'échecs"],
    ["SR", "Suriname organiseert een schaakfestival"], ["GY", "Guyana hosts chess festival"]]) {
    assert.equal(relevant(id, "culture", title), false, title);
    assert.equal(relevant(id, "culture", `${title}: music concert`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
  assert.equal(relevant("AR", "culture", "Argentina inaugura exposición de réplicas de esculturas y arte"), true);
});

test("the Defensa y Justicia club name does not supply crime evidence", () => {
  const title = "Defensa y Justicia vs Independiente: previa del torneo de Argentina";
  assert.equal(relevant("AR", "crime", title), false);
  assert.equal(relevant("AR", "top", title), true);
  assert.equal(relevant("AR", "crime", `${title}: policía investiga un homicidio`), true);
  assert.equal(relevant("AR", "crime", "La justicia argentina condenó a un acusado de homicidio"), true);
});

test("police anniversaries and ceremonies need independent criminal evidence", () => {
  for (const [id, title] of [["AR", anniversary], ["BR", "Polícia do Brasil celebra seu aniversário"],
    ["GF", "Police de Guyane célèbre son anniversaire"], ["SR", "Politie Suriname viert jubileum"],
    ["GY", "Guyana police attend anniversary ceremony"]]) {
    assert.equal(relevant(id, "crime", title), false, title);
    assert.equal(relevant(id, "top", title), true, title);
    assert.equal(relevant(id, "crime", `${title}: murder investigation leads to arrests`), true, title);
  }
  assert.equal(relevant("AR", "crime", "Argentina recuerda el aniversario del asesinato de una maestra"), true);
});

test("Unimed Mercosul domestic cooperation needs an independent international partner", () => {
  assert.equal(relevant("BR", "world", domestic), false);
  assert.equal(relevant("BR", "top", domestic), true);
  assert.equal(relevant("BR", "world", `${domestic}: parceria com Argentina`), true);
  assert.equal(relevant("BR", "world", "Brasil amplia cooperação com Portugal"), true);
});

test("the named Futbolargentino match-tracker template is not a news report", () => {
  for (const key of ["top", "latest", "sports", "crime"]) assert.equal(relevant("AR", key, tracker, "Futbolargentino.com"), false, key);
  assert.equal(relevant("AR", "sports", "Argentina: Defensa y Justicia gana un partido de fútbol", "Futbolargentino.com"), true);
  assert.equal(relevant("AR", "crime", "Argentina: investigan un homicidio en el club Defensa y Justicia", "Futbolargentino.com"), true);
});

test("live selection rejects observed context errors while preserving replacement dates", async () => {
  for (const [id, key, bad, source, good] of cases) {
    const items = [article(bad, source), article(good)];
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const selected = await fetchArticlesForFeed(country(id), feed(key), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(selected.map(a => a.title), [good], bad);
    assert.equal(selected[0].publishedAt, items[1].publishedAt);
  }
});

test("cached recovery rejects the same context errors instead of renewing them", async t => {
  for (const [id, key, bad, source] of cases) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-context-cache-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [article(bad, source)] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [article(`${country(id).name} news`)] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0, bad);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null, bad);
  }
});
