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
const bad = "Comunidad mexicana celebra Día de los Muertos en Praga con tradición y cultura | Ecuador al Día";
const good = "Comunidad ecuatoriana celebra su cultura en Praga | Ecuador al Día";
const trial = "Ministro de Cultura de Perú enfrentará juicio por presunta colusión agravada";
const promotion = "Gobierno oficializa ascensos: Paz reconoce a nuevos generales de las FFAA y la Policía Boliviana";
const environmental = "México reafirma en la COP17 su compromiso con la conservación de la biodiversidad, la restauración ecológica y la justicia ambiental";
const civil = "A Justiça de São Paulo concedeu nesta terça-feira, 3, uma liminar (decisão judicial provisória urgente) à Associação Nacional de Jornais (ANJ), à Associação Brasileira de Emissoras de Rádio e Televisão (Abert) e à Associação Nacional de Editores de Revi";
const oldRadio = "DALE PLAY | Jueves 06 de junio: Fiscal general de Venezuela aseguró que el crimen del ex teniente Ronald Ojeda se trató de una operación de falsa bandera";
const cases = [
  ["EC", "culture", bad, good, "Howl.Link"],
  ["PE", "culture", trial, "Perú presenta una exposición de arte", "CRprensa.com"],
  ["BO", "crime", promotion, "Bolivia investiga un asesinato", "Red Uno"],
  ["MX", "crime", environmental, "México investiga un asesinato", "Hoja de Ruta Digital"],
  ["BR", "crime", civil, "Brasil investiga um homicídio", "Instagram"],
  ["VE", "crime", oldRadio, "Venezuela investiga un crimen", "Tele13 Radio"]
];
const article = title => ({ title, sourceName: "Howl.Link", url: `https://example.com/${encodeURIComponent(title)}`,
  publishedAt: new Date(Date.now() - 3600_000).toISOString() });
const relevant = (id, key, title) => isRelevantArticle(article(title), country(id), feed(key), { lookbackDays: 14 });

test("a trailing Ecuador al Día credit cannot supply national evidence", () => {
  for (const key of ["top", "latest", "culture"]) {
    assert.equal(relevant("EC", key, bad), false);
    assert.equal(relevant("EC", key, good), true);
    assert.equal(relevant("EC", key, "Ecuador presenta una exposición de arte | Ecuador al Día"), true);
  }
  for (const credit of [" | Ecuador al Día", " — Ecuador al Dia", " – Ecuador al Día", " - Ecuador al Día "]) {
    assert.equal(relevant("EC", "culture", `Artistas mexicanos presentan su música en Praga${credit}`), false);
  }
  assert.equal(relevant("MX", "culture", bad), true);
  assert.equal(relevant("EC", "culture", "Ecuador al Día presenta una exposición de arte ecuatoriano"), true);
  assert.equal(relevant("EC", "culture", "Ecuador celebra el Día de los Muertos con música"), true);
  const stale = { ...article(good), publishedAt: new Date(Date.now() - 15 * 86400_000).toISOString() };
  assert.equal(isRelevantArticle(stale, country("EC"), feed("culture"), { lookbackDays: 14 }), false);
});

test("a culture minister's unrelated criminal case needs independent arts evidence", () => {
  assert.equal(relevant("PE", "culture", trial), false);
  assert.equal(relevant("PE", "crime", `${trial} por un delito`), true);
  assert.equal(relevant("PE", "top", trial), true);
  assert.equal(relevant("PE", "culture", `${trial} por contratos de museos`), true);
  assert.equal(relevant("PE", "culture", "Ministra de Cultura de Perú acusada de corrupción en una asesoría legal"), false);
  assert.equal(relevant("PE", "culture", "Ministro de Cultura de Perú anuncia nuevos fondos"), true);
  assert.equal(relevant("PE", "culture", "Perú inaugura exposición sobre justicia y cultura"), true);
});

test("environmental justice needs independent criminal evidence", () => {
  assert.equal(relevant("MX", "crime", environmental), false);
  assert.equal(relevant("MX", "top", environmental), true);
  assert.equal(relevant("MX", "crime", `${environmental}: investigan un delito`), true);
  assert.equal(relevant("BR", "crime", "Brasil promove justiça ambiental"), false);
  assert.equal(relevant("GF", "crime", "Guyane : conférence sur la justice environnementale"), false);
  assert.equal(relevant("GY", "crime", "Guyana promotes environmental justice"), false);
});

test("police rank promotions require separate crime evidence", () => {
  assert.equal(relevant("BO", "crime", promotion), false);
  assert.equal(relevant("BO", "top", promotion), true);
  assert.equal(relevant("BO", "crime", "Bolivia: Policía investiga un delito en los ascensos"), true);
});

test("the reviewed publishers' civil injunction is not criminal justice", () => {
  assert.equal(relevant("BR", "crime", civil), false);
  assert.equal(relevant("BR", "top", civil), true);
  assert.equal(relevant("BR", "crime", `${civil}: investigação de homicídio`), true);
  assert.equal(relevant("BR", "crime", "Brasil: Justiça concede liminar em investigação de homicídio"), true);
});

test("the primary-dated June 2024 radio episode cannot be renewed by an RSS crawl", () => {
  for (const key of ["top", "latest", "crime"]) {
    assert.equal(isRelevantArticle({ ...article(oldRadio), sourceName: "Tele13 Radio" }, country("VE"), feed(key), { lookbackDays: 14 }), false);
  }
  assert.equal(isRelevantArticle({ ...article("Venezuela: nuevas pruebas en el crimen de Ronald Ojeda"), sourceName: "Tele13 Radio" }, country("VE"), feed("crime"), { lookbackDays: 14 }), true);
});

test("live selection preserves independent national coverage and original dates", async () => {
  for (const [id, key, rejected, replacement, sourceName] of cases) {
    const items = [rejected, replacement].map(title => ({ ...article(title), sourceName }));
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const selected = await fetchArticlesForFeed(country(id), feed(key), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(selected.map(a => a.title), [replacement]);
    assert.equal(selected[0].publishedAt, items[1].publishedAt);
  }
});

test("cached recovery rejects the same evidence defects without renewing entries", async t => {
  for (const [id, key, rejected, replacement, sourceName] of cases) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-publisher-geography-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [{ ...article(rejected), sourceName }] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [{ ...article(replacement), sourceName }] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null);
  }
});
