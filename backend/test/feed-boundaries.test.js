import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { feedConfigs, isRelevantArticle } from "../src/feedSearch.js";
import { generateFeeds, fetchArticlesForFeed } from "../scripts/generate-static-feeds.mjs";

const countries = JSON.parse(await readFile(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url)));
const country = id => countries.find(c => c.id === id);
const feed = key => feedConfigs.find(f => f.key === key);
const now = Date.UTC(2026, 9, 31, 6);
const article = (title, sourceName = "Example", time = now) => ({ title, sourceName,
  url: `https://example.com/${encodeURIComponent(title)}`, publishedAt: new Date(time - 3600_000).toISOString() });
const relevant = (id, key, item) => isRelevantArticle(item, country(id), feed(key), { lookbackDays: 14 }, now);

const sports = [
  ["BR", "Brasil bate Guiné e fecha Copa do Mundo e Festival Sub-15 da FIFA em quinto lugar"],
  ["BO", "Bolivia concluyó una histórica travesía en el primer Mundial y Festival Sub-15"],
  ["PA", "Con gran éxito culmina el circuito nacional del Festival de Fútbol Femenino Canal de Panamá 2026"],
  ["HN", "Honduras culminó el Festival Mundial de la FIFA con el mejor rendimiento de la zona"],
  ["GF", "Guyane accueille un festival de football"],
  ["SR", "Suriname organiseert een voetbalfestival"],
  ["GY", "Guyana wins cricket festival final"]
];
test("sporting festivals require independent cultural evidence in every supported language", () => {
  for (const [id, title] of sports) {
    assert.equal(relevant(id, "culture", article(title)), false, title);
    assert.equal(relevant(id, "culture", article(`${title}: musicians perform a concert`)), true, title);
  }
  assert.equal(relevant("SR", "culture", article("Jeangu Macrooy keert terug naar Suriname voor gratis Potpourri Festival")), true);
});

test("cooperation needs an international subject rather than a domestic agreement alone", () => {
  for (const [id, title] of [
    ["AR", "Acuerdo en Jujuy: Kicillof expande por Argentina sus convenios de cooperación"],
    ["BR", "Brasil anuncia cooperação entre municípios"],
    ["GF", "Guyane renforce la coopération entre écoles locales"],
    ["SR", "Suriname versterkt samenwerking tussen lokale scholen"],
    ["GY", "Guyana expands cooperation between local councils"]
  ]) assert.equal(relevant(id, "world", article(title)), false, title);
  for (const [id, title] of [
    ["AR", "Perú y Argentina evalúan proyectos de cooperación"],
    ["BR", "Brasil e China ampliam cooperação"],
    ["GF", "La coopération entre la Guyane et le Brésil reste fragile"],
    ["SR", "Suriname en Duitsland willen samenwerking uitbreiden"],
    ["GY", "Guyana strengthens cooperation with Canada"],
    ["PA", "Panama signs cooperation agreement with Panama City, Florida"],
    ["GY", "Guyana and Canada strengthen cooperation between local councils"],
    ["GT", "Huelva refuerza su cooperación con Guatemala con cinco proyectos"],
    ["PY", "Paraguay y la Orden de Malta afianzan cooperación"]
  ]) assert.equal(relevant(id, "world", article(title)), true, title);
});

test("financial and prevention culture are not arts, while independent cultural evidence survives", () => {
  for (const [id, title] of [
    ["PA", "Cultura de ahorro en Panamá: Solo el 44% de las familias logra guardar dinero"],
    ["BO", "Bolivia necesita fortalecer una cultura de inversión"],
    ["NI", "Claro Nicaragua impulsa una cultura de prevención y seguridad vial"],
    ["BR", "Brasil promove cultura de poupança"],
    ["BR", "Brasil promove uma cultura de investimento"],
    ["GF", "Guyane développe une culture de la prévention"],
    ["GF", "Guyane développe une culture de l'investissement"],
    ["SR", "Suriname bevordert een spaarcultuur"],
    ["SR", "Suriname bevordert een beleggingscultuur"],
    ["GY", "Guyana encourages a savings culture"],
    ["GY", "Guyana encourages an investment culture"]
  ]) {
    assert.equal(relevant(id, "culture", article(title)), false, title);
    assert.equal(relevant(id, "culture", article(`${title}: music festival`)), true, title);
  }
});

test("country names inside foreign place names and figurative phrases need independent national evidence", () => {
  for (const [id, title] of [
    ["UY", "El Cine San Martín de Concepción del Uruguay suspende sus funciones por problemas técnicos"],
    ["EC", "Granada 2031 Festival Fusión alcanza su ecuador con la música como puente entre culturas"],
    ["PE", "Festival Mercadito La Perú ofrece dos días de música en Concepción"]
  ]) {
    assert.equal(relevant(id, "culture", article(title)), false, title);
    assert.equal(relevant(id, "culture", article(`${title}; artistas de ${country(id).name}`)), true, title);
  }
  assert.equal(relevant("EC", "culture", article("El Ecuador celebra su música con un festival")), true);
});

test("recrawled event-directory listings cannot acquire a new original publication date", () => {
  for (const title of [
    "Festival El Grito Guatemala 2018", "Festival de Lectores 2025 de 30Libros en Guatemala",
    "Festival de Mango 2026 en Ciudad de Guatemala", "Blues Festival 2026 en Guatemala",
    "Rocío Dúrcal en cine: concierto 20 años sin ti en Guatemala | Marzo 2026",
    "Anunciaron concierto de Lilly Palmer en Guatemala",
    "BTS en cine: transmisión en vivo de conciertos en Guatemala 2026",
    "Filgua 2026: La Feria del Libro en Guatemala contará con más de 600 actividades"
  ]) for (const key of ["culture", "top", "latest"]) {
    assert.equal(relevant("GT", key, article(title, "Guatemala.com")), false, `${key}: ${title}`);
  }
  assert.equal(relevant("GT", "culture", article("Guatemala inaugura un nuevo museo de arte", "Guatemala.com")), false);
  assert.equal(relevant("GT", "culture", article("Guatemala inaugura el festival de cine 2026", "Ministerio de Cultura")), true);
  const old = { ...article("Guatemala inaugura un museo de arte"), publishedAt: new Date(now - 15 * 86400_000).toISOString() };
  assert.equal(relevant("GT", "culture", old), false);
});

test("live RSS filtering rejects sporting festivals and recrawled listings before selecting genuine stories", async () => {
  for (const [id, bad, good] of [
    ["BR", article(sports[0][1]), article("Brasil inaugura festival de música")],
    ["GT", article("Festival El Grito Guatemala 2018", "Guatemala.com"), article("Guatemala inaugura museo de arte")]
  ]) {
    const items = [bad, good].map(a => ({ ...a, publishedAt: new Date(Date.now() - 3600_000).toISOString() }));
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const result = await fetchArticlesForFeed(country(id), feed("culture"), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(result.map(a => a.title), [good.title]);
    assert.equal(result[0].publishedAt, items[1].publishedAt);
  }
});

test("partial recovery cannot preserve known category, geography or original-date errors", async t => {
  for (const [id, key, bad, source] of [
    ["BR", "culture", sports[0][1]],
    ["AR", "world", "Acuerdo en Jujuy: Kicillof expande por Argentina sus convenios de cooperación"],
    ["UY", "culture", "El Cine de Concepción del Uruguay suspende sus funciones"],
    ["GT", "culture", "Festival El Grito Guatemala 2018", "Guatemala.com"]
  ]) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-boundary-cache-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [article(bad, source, Date.now())] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [article(`${country(id).name} news`, "Example", Date.now())] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null);
  }
});
