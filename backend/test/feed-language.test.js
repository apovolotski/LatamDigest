import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { feedConfigs, isRelevantArticle, searchPlans } from "../src/feedSearch.js";

const matrix = JSON.parse(await readFile(new URL("fixtures/language-matrix.json", import.meta.url)));
const observed = JSON.parse(await readFile(new URL("fixtures/observed-language-headlines.json", import.meta.url)));
const countries = JSON.parse(await readFile(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url)));
const now = Date.UTC(2026, 0, 15, 12);
const story = title => ({ title, publishedAt: new Date(now - 3600_000).toISOString() });
const irrelevant = {
  politics: "Athletes win a rugby final", business: "Police arrest a murder suspect",
  sports: "Parliament approves election rules", tech: "Artists perform a theatre concert",
  culture: "Engineers test artificial intelligence software", crime: "Parliament debates policies",
  economy: "Athletes win a rugby match", world: "Parliament approves a domestic housing policy"
};

test("language fixtures cover every app country and every feed in all five supported languages", () => {
  assert.deepEqual(matrix.countries.map(c => c.id).sort(), countries.map(c => c.id).sort());
  assert.deepEqual(Object.keys(matrix.headlines).sort(), ["en", "es", "fr", "nl", "pt"]);
  for (const headlines of Object.values(matrix.headlines)) {
    assert.deepEqual(Object.keys(headlines).sort(), feedConfigs.map(f => f.key).sort());
  }
});

for (const row of matrix.countries) {
  test(`${row.id}: all ten feeds accept native wording and English demonyms, reject unrelated places and dates`, () => {
    const country = countries.find(c => c.id === row.id);
    const other = countries.find(c => c.id === matrix.countries[(matrix.countries.indexOf(row) + 1) % countries.length].id);
    for (const feed of feedConfigs) {
      const plan = searchPlans(country, feed)[0];
      for (const prefix of row.nativePrefixes) {
        const title = `${prefix}: ${matrix.headlines[row.language][feed.key]}`;
        assert.equal(isRelevantArticle(story(title), country, feed, plan, now), true, `${feed.key}: ${title}`);
        assert.equal(isRelevantArticle(story(title.normalize("NFD").toUpperCase()), country, feed, plan, now), true, `Unicode/case: ${title}`);
      }
      const english = story(`${row.englishPrefix}: ${matrix.headlines.en[feed.key]}`);
      assert.equal(isRelevantArticle(english, country, feed, plan, now), true, `${feed.key}: ${english.title}`);
      assert.equal(isRelevantArticle(story(`${other.name}: ${matrix.headlines.en[feed.key]}`), country, feed, plan, now), false, `Wrong country: ${feed.key}`);
      assert.equal(isRelevantArticle({ ...english, publishedAt: new Date(now - 15 * 86_400_000).toISOString() }, country, feed, plan, now), false);
      assert.equal(isRelevantArticle({ ...english, publishedAt: new Date(now + 2 * 3600_000).toISOString() }, country, feed, plan, now), false);
      if (irrelevant[feed.key]) {
        assert.equal(isRelevantArticle(story(`${country.name}: ${irrelevant[feed.key]}`), country, feed, plan, now), false, `Wrong category: ${feed.key}`);
      }
    }
  });
}

for (const row of observed.cases) {
  test(`observed headline: ${row.country}/${row.feed}: ${row.title}`, () => {
    assert.equal(isRelevantArticle(story(row.title), countries.find(c => c.id === row.country), feedConfigs.find(f => f.key === row.feed), { lookbackDays: 7 }, now), true);
  });
}

const negatives = [
  ["TT", "sports", "Ole Miss football vs Texas prediction, will Trinidad Chambliss beat Arch Manning?"],
  ["TT", "culture", "Trinidad Tidings: Sea Festival, new film screening"],
  ["CU", "business", "Mark Cuban invests in a new technology company"],
  ["MX", "politics", "New Mexico government announces election rules"],
  ["PA", "top", "Panama City, Florida opens a new park"],
  ["CL", "culture", "Green chile festival opens in New Mexico"],
  ["GF", "politics", "Congrès Guyane Enfance Jeunesse : donner la parole aux jeunes ultramarins"],
  ["GF", "world", "Au Brésil, l’immobilier séduit de plus en plus de Guyanais"],
  ["MX", "world", "México cambia su política nacional de vivienda"],
  ["BR", "world", "Brasil revê sua política tributária"],
  ["SR", "business", "Suriname: minister van Buitenlandse Zaken ontmoet ambassadeurs"],
  ["MX", "world", "México gana un torneo internacional de fútbol"],
  ["BR", "world", "Brasil joga torneio internacional de futebol"],
  ["GF", "world", "La Guyane gagne un tournoi international de basket"],
  ["SR", "world", "Suriname speelt een internationale voetbalwedstrijd"],
  ["GY", "world", "Guyana wins an international cricket championship"],
  ["PR", "world", "Pedro Capó anuncia su gira internacional por Puerto Rico"],
  ["TT", "world", "Tobago’s Trendsetter Goofy, A Different Kind of Cultural Ambassador. Show Some Respect."],
  ["MX", "world", "México anuncia embajador de marca para festival"],
  ["BR", "world", "Brasil escolhe embaixadora da marca para evento"],
  ["GF", "world", "Guyane choisit une ambassadrice de marque pour son festival"],
  ["SR", "world", "Suriname kiest een culturele ambassadeur voor een festival"],
  ["MX", "world", "México nombra una embajadora cultural"],
  ["BR", "world", "Brasil escolhe uma embaixadora cultural"],
  ["GF", "world", "Guyane nomme une ambassadrice culturelle"],
  ["SR", "world", "Suriname benoemt een cultureel ambassadeur"],
  ["MX", "sports", "México prepara la selección de jueces y magistrados"],
  ["TT", "politics", "Trinidad festival starts at 5 PM"],
  ["SR", "crime", "Surinaamse politieke partijen debatteren over onderwijs"],
  ["TT", "sports", "Busta Cup, 2000/01 - Trinidad & Tobago Cricket Team Records & Stats"],
  ["GY", "sports", "Guyana (Basketball Women) :: Standings History"],
  ["SR", "sports", "Suriname Football National Team - Games, Standings, Squad and Stats"],
  ["SR", "top", "Suriname National Football Schedule for the International Football Season"]
];
for (const [id, key, title] of negatives) {
  test(`ambiguity regression: ${id}/${key}: ${title}`, () => {
    assert.equal(isRelevantArticle(story(title), countries.find(c => c.id === id), feedConfigs.find(f => f.key === key), { lookbackDays: 14 }, now), false);
  });
}

test("disambiguation preserves real country references and genuine cultural or sports diplomacy", () => {
  for (const [id, key, title] of [
    ["TT", "sports", "Trinidad and Tobago welcomes football player Trinidad Chambliss"],
    ["CU", "business", "Mark Cuban discusses investment in Cuba"],
    ["MX", "world", "Mexico and New Mexico announce bilateral cooperation"],
    ["PA", "world", "Panama signs cooperation agreement with Panama City, Florida"],
    ["SR", "world", "Suriname en Spanje vieren diplomatieke betrekkingen met concert"],
    ["BR", "world", "Brasil e Argentina assinam cooperação diplomática no futebol"],
    ["GF", "world", "Guyane et Brésil renforcent leur coopération diplomatique"],
    ["PR", "world", "Puerto Rico anuncia cooperación cultural internacional con España"],
    ["NI", "world", "Nicaragua y Camboya celebran primera ronda de consultas políticas"],
    ["GF", "crime", "French Guianese police recover a stolen Porsche Cayenne"],
    ["GF", "tech", "French Guiana tests a new Porsche Cayenne technology"],
    ["MX", "world", "México: embajadora cultural visita el consulado de España"],
    ["TT", "sports", "Trinidad and Tobago sets new cricket records"]
  ]) assert.equal(isRelevantArticle(story(title), countries.find(c => c.id === id), feedConfigs.find(f => f.key === key), { lookbackDays: 14 }, now), true, title);
});

test("Trinidad queries prioritize the country name over an athlete's first name", () => {
  for (const feed of feedConfigs) {
    for (const plan of searchPlans(countries.find(c => c.id === "TT"), feed)) {
      assert.match(plan.countryQuery, /"Trinidad and Tobago"/);
      assert.doesNotMatch(plan.countryQuery, /"Trinidad" OR/);
    }
  }
});

test("wider localized searches include category vocabulary beyond the first six query terms", () => {
  const tails = { es: ["teatro", "literatura"], pt: ["teatro", "literatura"], fr: ["théâtre", "littérature"], nl: ["theater", "literatuur"], en: ["theatre", "literature"] };
  for (const country of countries) for (const feed of feedConfigs) {
    if (["top", "latest"].includes(feed.key)) continue;
    const plans = searchPlans(country, feed);
    if (feed.key === "culture") {
      for (const term of tails[matrix.countries.find(c => c.id === country.id).language]) assert.ok(plans[1].query.includes(`"${term}"`));
    }
    for (const plan of plans) assert.ok((plan.query.match(/ OR /g) ?? []).length <= 6);
  }
});
