import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { feedConfigs, searchPlans, isRelevantArticle } from "../src/feedSearch.js";
import { fetchArticlesForFeed, generateFeeds, toArticle } from "../scripts/generate-static-feeds.mjs";
import { checkCoverage } from "../scripts/check-feed-coverage.mjs";

const countries = JSON.parse(await readFile(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url)));
const getCountry = id => countries.find(country => country.id === id);
const getFeed = key => feedConfigs.find(feed => feed.key === key);
const story = (title, daysAgo = 0, key = title) => ({ title, url: `https://example.com/${encodeURIComponent(key)}`,
  sourceName: "Example", publishedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString() });
const rss = articles => `<rss><channel>${articles.map(article => `<item><title>${article.title}</title><link>${article.url}</link><source>${article.sourceName}</source><pubDate>${article.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
const options = { sleep: async () => {} };
const cultureIncident = JSON.parse(await readFile(new URL("fixtures/suriname-culture.json", import.meta.url)));

test("incident 39946815347: Surinamese adjectives and Dutch cultural compounds retain real reporting", async () => {
  const country = getCountry("SR"), feed = getFeed("culture"), plan = searchPlans(country, feed)[0];
  const articles = cultureIncident.map((item, i) => ({ ...story(item.title, item.daysAgo, `incident-${i}`), sourceName: item.sourceName }));
  for (const article of articles.slice(0, 4)) assert.equal(isRelevantArticle(article, country, feed, plan), true, article.title);
  assert.equal(isRelevantArticle(articles[4], country, feed, plan), false);
  for (const title of ["Surinaamse economie groeit", "Suriname gebruikt kunstmatige intelligentie", "Indonesië organiseert concert"]) {
    assert.equal(isRelevantArticle(story(title), country, feed, plan), false, title);
  }
  assert.equal(isRelevantArticle(story(articles[0].title, 15), country, feed, { lookbackDays: 14 }), false);
  const result = await fetchArticlesForFeed(country, feed, { ...options, fetchImpl: async () => new Response(rss(articles)) });
  assert.equal(result.length, 4);
  assert.equal(result.some(article => article.title.includes("Kolkata")), false);
});

test("English cultural fallback accepts cultural reporting while preserving geographic and date checks", () => {
  const country = getCountry("SR"), feed = getFeed("culture"), plan = { lookbackDays: 14 };
  assert.equal(isRelevantArticle(story("RI proposes cultural cooperation to strengthen ties with Suriname"), country, feed, plan), true);
  assert.equal(isRelevantArticle(story("Surinamese film wins award"), country, feed, plan), true);
  assert.equal(isRelevantArticle(story("RI proposes cultural cooperation with Indonesia"), country, feed, plan), false);
});

test("all 24 countries and ten feeds have bounded country-scoped search plans", () => {
  assert.equal(countries.length * feedConfigs.length, 240);
  for (const country of countries) for (const feed of feedConfigs) {
    const plans = searchPlans(country, feed);
    assert.ok(plans.length >= 2 && plans.length <= 3);
    for (const plan of plans) {
      assert.ok(plan.query.includes(plan.countryQuery));
      assert.ok(plan.lookbackDays <= 14);
      assert.ok(plan.locale.hl && plan.locale.gl && plan.locale.ceid);
      assert.ok(!plan.query.includes("latest news"));
      assert.ok((plan.query.match(/ OR /g) ?? []).length <= 6);
    }
  }
});

test("the six empty feeds use local country and topic vocabulary", () => {
  for (const id of ["DO", "NI"]) assert.match(searchPlans(getCountry(id), getFeed("economy"))[0].query, /economía/);
  assert.match(searchPlans(getCountry("DO"), getFeed("economy"))[0].query, /República Dominicana/);
  for (const key of ["latest", "culture", "economy", "world"]) {
    const plan = searchPlans(getCountry("GF"), getFeed(key))[0];
    assert.match(plan.query, /"Guyane"/);
    assert.equal(plan.locale.ceid, "FR:fr");
  }
  assert.match(searchPlans(getCountry("BR"), getFeed("economy"))[0].query, /inflação/);
  assert.equal(searchPlans(getCountry("SR"), getFeed("tech"))[0].locale.ceid, "NL:nl");
});

test("headline checks reject wrong country, wrong category, old and future stories", () => {
  const country = getCountry("NI"), feed = getFeed("economy"), plan = searchPlans(country, feed)[0];
  assert.equal(isRelevantArticle(story("Nicaragua eleva su previsión de inflación"), country, feed, plan), true);
  assert.equal(isRelevantArticle(story("La economía de Argentina crece"), country, feed, plan), false);
  assert.equal(isRelevantArticle(story("Nicaragua gana torneo de fútbol"), country, feed, plan), false);
  assert.equal(isRelevantArticle(story("Nicaragua eleva su previsión de inflación", 8), country, feed, plan), false);
  assert.equal(isRelevantArticle(story("Nicaragua eleva su previsión de inflación", -1), country, feed, plan), false);
});

test("French Guiana checks reject Cayenne car results and unrelated Caribbean headlines", () => {
  const country = getCountry("GF");
  for (const [key, title] of [["latest", "Comparatif : Porsche Cayenne vs Porsche Taycan"],
    ["culture", "Un homme tué par balle en Martinique"]]) {
    const feed = getFeed(key);
    assert.equal(isRelevantArticle(story(title), country, feed, searchPlans(country, feed)[0]), false);
  }
  const feed = getFeed("culture");
  assert.equal(isRelevantArticle(story("Atip'Art : le street-art s'empare de Macouria"), country, feed, searchPlans(country, feed)[0]), true);
});

test("sparse categories widen the date window while preserving country and category", async () => {
  const urls = [];
  const articles = [1, 2, 3].map(i => story(`Nicaragua: crecimiento económico ${i}`, 10, `story${i}`));
  const result = await fetchArticlesForFeed(getCountry("NI"), getFeed("economy"), { ...options,
    fetchImpl: async url => { urls.push(url); return new Response(rss(urls.length === 1 ? [] : articles)); }
  });
  assert.equal(result.length, 3);
  assert.equal(urls.length, 2);
  assert.match(urls[0].searchParams.get("q"), /when:7d/);
  assert.match(urls[1].searchParams.get("q"), /when:14d/);
  assert.equal(result.coverage.fallbackUsed, true);
  assert.equal(result.coverage.lookbackDays, 14);
});

test("English fallback stays scoped and preserves real publication dates", async () => {
  let calls = 0;
  const article = story("French Guiana economy sees export growth", 9);
  const result = await fetchArticlesForFeed(getCountry("GF"), getFeed("economy"), { ...options,
    fetchImpl: async url => {
      calls++;
      if (calls < 3) return new Response(rss([]));
      assert.equal(url.searchParams.get("ceid"), "US:en");
      assert.match(url.searchParams.get("q"), /"French Guiana"/);
      return new Response(rss([article]));
    }
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].publishedAt, article.publishedAt);
  assert.equal(calls, 3);
});

test("fallback failure retains already retrieved relevant articles", async () => {
  let calls = 0;
  const result = await fetchArticlesForFeed(getCountry("GF"), getFeed("economy"), { ...options,
    fetchImpl: async () => {
      if (++calls === 1) return new Response(rss([story("Emploi en Guyane : une reprise")]));
      throw Error("private provider detail");
    }
  });
  assert.equal(result.length, 1);
  assert.equal(result.coverage.fallbackUnavailable, true);
});

test("RSS numeric publisher names and malformed items cannot fail the whole feed", async () => {
  const result = await fetchArticlesForFeed(getCountry("AR"), { key: "sports", label: "Sports", query: () => "Argentina" }, {
    ...options, fetchImpl: async () => new Response(rss([{ ...story("Argentina gana torneo"), sourceName: "442" }]))
  });
  assert.equal(result[0].sourceName, "442");
  assert.equal(toArticle(null, getCountry("AR"), getFeed("sports")), null);
  assert.doesNotThrow(() => toArticle({ title: "News", link: "https://example.com", pubDate: new Date().toISOString(), source: { "#text": {} } }, getCountry("AR"), getFeed("sports")));
});

test("all RSS candidates are sorted before limiting and duplicate IDs are removed", async () => {
  const articles = Array.from({ length: 14 }, (_, i) => story(`Nicaragua economía ${i}`, 0.5 - i * 0.01, `story${i}`));
  articles.push({ ...articles[0], title: "Nicaragua economía, título cambiado" });
  const result = await fetchArticlesForFeed(getCountry("NI"), getFeed("economy"), { ...options,
    fetchImpl: async () => new Response(rss(articles))
  });
  assert.equal(result.length, 12);
  assert.equal(result[0].title, articles[13].title);
  assert.equal(new Set(result.map(article => article.id)).size, 12);
});

async function coverageFixture(t) {
  const destination = await mkdtemp(path.join(tmpdir(), "latam-coverage-"));
  t.after(() => rm(destination, { recursive: true, force: true }));
  const country = getCountry("NI");
  const title = "Nicaragua: economía, política, empresas, deportes, tecnología, cultura, crimen y diplomacia";
  const article = toArticle({ title, link: "https://example.com/story", pubDate: new Date().toISOString(), source: "Example" }, country, getFeed("top"));
  await generateFeeds({ countries: [country], destination, fetchFeed: async () => [article] });
  return { destination, countries: [country] };
}

test("coverage verifier accepts all populated feeds and reports sparse counts honestly", async t => {
  const options = await coverageFixture(t);
  const report = await checkCoverage(options);
  assert.deepEqual(report.issues, []);
  assert.equal(report.populated, 10);
  assert.equal(report.sparse, 10);
});

test("coverage verifier blocks empty, outdated and unrelated publications", async t => {
  const options = await coverageFixture(t);
  await writeFile(path.join(options.destination, "countries/NI/top.json"), "[]");
  const file = path.join(options.destination, "countries/NI/category/economy.json");
  const articles = JSON.parse(await readFile(file));
  articles[0].title = "Argentina gana un partido";
  articles[0].publishedAt = "2000-01-01T00:00:00.000Z";
  await writeFile(file, JSON.stringify(articles));
  const report = await checkCoverage(options);
  assert.ok(report.issues.some(issue => issue.includes("NI/top: empty")));
  assert.ok(report.issues.some(issue => issue.includes("outdated, or unrelated")));
});

test("coverage verifier blocks missing countries, categories and incorrect counts", async t => {
  const options = await coverageFixture(t);
  const file = path.join(options.destination, "manifest.json");
  const manifest = JSON.parse(await readFile(file));
  delete manifest.countries[0].feeds.world;
  manifest.countries[0].feeds.economy.count = 999;
  manifest.countries.push({ id: "XX", feeds: {} });
  await writeFile(file, JSON.stringify(manifest));
  const report = await checkCoverage(options);
  assert.ok(report.issues.some(issue => issue.includes("country set")));
  assert.ok(report.issues.some(issue => issue.includes("category set")));
  assert.ok(report.issues.some(issue => issue.includes("count mismatch")));
});

test("local business vocabulary and T&T abbreviations identify previously missed coverage", () => {
  const gf = getCountry("GF"), business = getFeed("business");
  const gfPlan = searchPlans(gf, business)[1];
  assert.equal(isRelevantArticle(story("De Cayenne à l’Amapá, les experts-comptables de Guyane bâtissent des ponts"), gf, business, gfPlan), true);
  const tt = getCountry("TT"), world = getFeed("world"), ttPlan = searchPlans(tt, world)[0];
  assert.equal(isRelevantArticle(story("T&T hosts CARICOM diplomatic talks"), tt, world, ttPlan), true);
  assert.equal(isRelevantArticle(story("Trinidad wins an international football match"), tt, world, ttPlan), false);
});


test("ambiguous French prix and a technology-branded golf event do not fill unrelated categories", () => {
  const country = getCountry("GF"), feed = getFeed("economy"), plan = searchPlans(country, feed)[0];
  assert.equal(isRelevantArticle(story("Trois chercheuses de Guyane récompensées par le prix L’Oréal"), country, feed, plan), false);
  assert.equal(isRelevantArticle(story("Flambée des carburants en Guyane : les prix en rayon augmentent"), country, feed, plan), true);
  const mx = getCountry("MX"), tech = getFeed("tech");
  assert.equal(isRelevantArticle(story("México jugará el World Wide Technology Championship"), mx, tech, searchPlans(mx, tech)[0]), false);
});

test("extended searches do not publish stories that will expire before the next refresh", async () => {
  const nearExpiry = story("Nicaragua: economía cerca del límite", 13.5);
  const fresh = [story("Nicaragua: economía diez días", 10), story("Nicaragua: economía once días", 11)];
  let calls = 0;
  const result = await fetchArticlesForFeed(getCountry("NI"), getFeed("economy"), { ...options,
    fetchImpl: async () => new Response(rss(++calls === 1 ? [] : [nearExpiry, ...fresh]))
  });
  assert.equal(result.length, 2);
  assert.equal(result.coverage.fallbackUsed, true);
  assert.equal(result.some(article => article.title === nearExpiry.title), false);
  assert.equal(result[0].publishedAt, fresh[0].publishedAt);
});
