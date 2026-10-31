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
const now = Date.UTC(2026, 9, 31, 13);
const article = (title, time = now) => ({ title, sourceName: "Example",
  url: `https://example.com/${encodeURIComponent(title)}`, publishedAt: new Date(time - 3600_000).toISOString() });
const relevant = (id, key, title) => isRelevantArticle(article(title), country(id), feed(key), { lookbackDays: 14 }, now);
const spam = "SCANDAL VIDEOs XNXX Video De La Policía De Guatemala Con El Micrófono En La Boca Original Clip Full SEX VIDEOS ON HD";
const geography = "Guyane : le roi Charles III rencontre le président guyanais Irfaan Ali";
const resort = "Policía Local de Mogán, Guardia Civil y Policía Canaria realizan un operativo conjunto en los centros comerciales de Puerto Rico";
const policeSport = "West Indies Masters provide grassroots boost to Guyana Police Force youth academy";
const diplomat = "Brasil citó a la encargada de negocios de Argentina por la salida de Flávio Bolsonaro";

test("diplomatic job titles do not independently establish business coverage", () => {
  for (const [id, title] of [
    ["AR", diplomat], ["BR", "Brasil convoca a encarregada de negócios da Argentina"],
    ["GF", "Guyane reçoit le chargé d'affaires"], ["GY", "Guyana welcomes the chargé d'affaires"]
  ]) {
    assert.equal(relevant(id, "business", title), false, title);
    assert.equal(relevant(id, "business", `${title}: investment agreement for companies`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
});

test("French Guyana translations and the Gran Canaria resort need independent national evidence", () => {
  for (const key of ["top", "latest", "politics"]) assert.equal(relevant("GF", key, geography), false);
  assert.equal(relevant("GF", "politics", `${geography}; le président visite Cayenne`), true);
  assert.equal(relevant("GF", "world", "La Guyane et le Guyana développent leur coopération"), true);
  assert.equal(relevant("GF", "politics", "Le président de la Guyane française rencontre Irfaan Ali"), true);
  assert.equal(relevant("GF", "politics", "Jean-Paul Ferreira élu à la présidence de la Collectivité territoriale de Guyane"), true);
  for (const key of ["top", "latest", "crime"]) assert.equal(relevant("PR", key, resort), false);
  assert.equal(relevant("PR", "crime", `${resort}; detenido un puertorriqueño`), true);
  assert.equal(relevant("PR", "crime", "Policía arresta a sospechoso en Puerto Rico"), true);
});

test("police sport and ceremonial honors require independent crime evidence", () => {
  for (const [id, title] of [
    ["GY", policeSport], ["CO", "Honor a quienes sirvieron a Colombia: Policía Nacional exalta el legado de los veteranos"],
    ["BR", "Polícia do Brasil homenageia veteranos"], ["GF", "Police de Guyane rend hommage aux vétérans"],
    ["SR", "Politie Suriname organiseert voetbal voor jongeren"]
  ]) {
    assert.equal(relevant(id, "crime", title), false, title);
    assert.equal(relevant(id, "crime", `${title}: fraud investigation leads to arrests`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
  assert.equal(relevant("GY", "crime", "Guyana police arrest youth academy coach for fraud"), true);
});

test("social and employment justice alone are not criminal justice", () => {
  for (const [id, title] of [
    ["CU", "Desde la Presidencia: La batalla de la Revolución cubana por la justicia social"],
    ["BR", "De norte a sul do Brasil, quem são as pessoas que fazem a Justiça do Trabalho chegar a quem precisa?"],
    ["GF", "Guyane développe la justice sociale"], ["GY", "Guyana launches social justice programme"]
  ]) {
    assert.equal(relevant(id, "crime", title), false, title);
    assert.equal(relevant(id, "crime", `${title}: corruption investigation`), true, title);
  }
});

test("wildlife education festivals require independent arts evidence", () => {
  for (const [id, title] of [
    ["BO", "Llega a La Paz el Festival del Gato Andino y los Felinos de Bolivia"],
    ["GF", "Guyane accueille un festival de biodiversité"],
    ["SR", "Suriname organiseert een festival over biodiversiteit"],
    ["GY", "Guyana hosts a wildlife festival"]
  ]) {
    assert.equal(relevant(id, "culture", title), false, title);
    assert.equal(relevant(id, "culture", `${title}: music and theatre performances`), true, title);
  }
  assert.equal(relevant("TT", "culture", "Karate seminar promotes Japanese culture in T&T"), true);
});

test("international airport names, friendlies and book or culinary prizes do not prove world coverage", () => {
  for (const [id, title] of [
    ["MX", "Aeropuerto Internacional de la Ciudad de México: estatus de vuelos demorados o cancelados"],
    ["BO", "Perú enfrentará a Bolivia en amistoso internacional y jugará en inesperada sede"],
    ["PY", "El pickleball paraguayo amplió su participación internacional en el Colombia Open 2026"],
    ["EC", "Recibirá libro de Aicodi premio internacional en Ecuador"],
    ["EC", "Quesos ecuatorianos conquistan el oro y la plata en concurso internacional de Uruguay"],
    ["GF", "Aéroport international de Guyane : vols retardés"],
    ["GY", "Guyana international airport delays flights"]
  ]) {
    assert.equal(relevant(id, "world", title), false, title);
    assert.equal(relevant(id, "world", `${title}: diplomatic talks with ambassadors`), true, title);
  }
  assert.equal(relevant("EC", "world", "Ecuador firma un acuerdo internacional para proteger tiburones"), true);
  assert.equal(relevant("CO", "world", "Estudiantes mexicanos realizan misión académica internacional en Colombia"), true);
});

test("promotional explicit-video spam is rejected without suppressing legitimate crime reporting", () => {
  for (const key of feedConfigs.map(f => f.key)) assert.equal(relevant("GT", key, spam), false, key);
  for (const title of [
    "Guatemala investiga difusión no consentida de videos sexuales: policía detiene a sospechoso",
    "Guatemala police investigate illegal videos on Pornhub",
    "Guatemala police investigate sexual assault"
  ]) assert.equal(relevant("GT", "crime", title), true, title);
});

test("live RSS filtering rejects spam and geographic confusion with original dates intact", async () => {
  for (const [id, key, bad, good] of [
    ["GT", "crime", spam, "Guatemala police arrest a murder suspect"],
    ["GF", "politics", geography, "Guyane : le gouvernement annonce un budget pour Cayenne"],
    ["AR", "business", diplomat, "Argentina anuncia nuevas inversiones empresariales"]
  ]) {
    const items = [bad, good].map(title => article(title, Date.now()));
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const result = await fetchArticlesForFeed(country(id), feed(key), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(result.map(a => a.title), [good]);
    assert.equal(result[0].publishedAt, items[1].publishedAt);
  }
});

test("cached recovery cannot restore newly identified spam or semantic errors", async t => {
  for (const [id, key, bad] of [
    ["GT", "crime", spam], ["GF", "politics", geography], ["PR", "crime", resort],
    ["GY", "crime", policeSport], ["AR", "business", diplomat],
    ["BO", "culture", "Festival del Gato Andino y los Felinos de Bolivia"],
    ["MX", "world", "Aeropuerto Internacional de la Ciudad de México: vuelos demorados"]
  ]) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-editorial-cache-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [article(bad, Date.now())] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [article(`${country(id).name} news`, Date.now())] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null);
  }
});
