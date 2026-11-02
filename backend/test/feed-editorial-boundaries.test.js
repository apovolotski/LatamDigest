import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { feedConfigs, isRelevantArticle, searchPlans } from "../src/feedSearch.js";
import { generateFeeds, fetchArticlesForFeed } from "../scripts/generate-static-feeds.mjs";

const countries = JSON.parse(await readFile(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url)));
const country = id => countries.find(c => c.id === id);
const feed = key => feedConfigs.find(f => f.key === key);
const now = Date.UTC(2026, 9, 31, 13);
const article = (title, time = now) => ({ title, sourceName: "Example",
  url: `https://example.com/${encodeURIComponent(title)}`, publishedAt: new Date(time - 3600_000).toISOString() });
const relevant = (id, key, title) => isRelevantArticle(article(title), country(id), feed(key), { lookbackDays: 14 }, now);
const spam = "SCANDAL VIDEOs XNXX Video De La Policía De Guatemala Con El Micrófono En La Boca Original Clip Full SEX VIDEOS ON HD";
const leakVideoCaption = "Filtración TOBAGO TAXI DRIVER VIRAL VIDEO";
const geography = "Guyane : le roi Charles III rencontre le président guyanais Irfaan Ali";
const resort = "Policía Local de Mogán, Guardia Civil y Policía Canaria realizan un operativo conjunto en los centros comerciales de Puerto Rico";
const policeSport = "West Indies Masters provide grassroots boost to Guyana Police Force youth academy";
const diplomat = "Brasil citó a la encargada de negocios de Argentina por la salida de Flávio Bolsonaro";
const tradeProfile = "Granos de cacao en el Comercio de Nicaragua | Observatorio de Complejidad Económica";

const policeGames = "República Dominicana conquista el segundo lugar en los IV Juegos Mundiales de Policías USIP 2026";
const bankTable = "Inversiones en Valores Neta — Panamá — Situación Consolidado — Centro Bancario Internacional";
const publisherCredit = "Keiko Fujimori señala replicar medidas de El Salvador para combatir el crimen | El Comercio";
const hashtags = "#Chile #j#Chile #justicia #Viceministrousticia #Viceministro";
const recrawledEconomy = "Economy celebra siete años y se consolida como referente informativo del ecosistema empresarial boliviano";
const agmerUruguay = "Agmer Uruguay se movilizó para exigir justicia por Nancy Godoy";
const civilArbitration = "Justicia internacional falló a favor de Uruguay en el caso Aratirí, el mayor arbitraje de la historia del país";
const economyAliasCorridor = "Bolivia y Paraguay plantean corredor de 1.222 kilómetros para ampliar el comercio y la conexión con el Atlántico";
const leagueTable = "Suriname Major League Table: Football Scores, Results & Fixtures";
const liveMatch = "Notch - Voorwaarts Live - Suriname Major League: Football Scores & Highlights - 24/10/2026";
const playerStats = "Minutes played - Trinidad and Tobago stats for World Cup Qualification CONCACAF 2024/2025";
const shopClassified = "À CÉDER – FONDS DE COMMERCE D'OPTIQUE-LUNETTERIE EN GUYANE FRANÇAISE";
const serviceCompany = "Une société d'événementiel funéraire en Guyane pour soulager les familles confrontées au deuil";
const sourceFor = title => title === bankTable ? "Finanzas Digital" : title === recrawledEconomy ? "www.economy.com.bo"
  : title === economyAliasCorridor ? "Economy Bolivia" : [leagueTable, liveMatch].includes(title) ? "TNT Sports"
    : title === playerStats ? "FotMob" : title === leakVideoCaption ? "Port of Rotterdam" : title === shopClassified ? "Acuité" : "Example";

test("Acuité shop-sale classifieds are excluded while business reporting remains eligible", () => {
  for (const key of ["top", "latest", "business"]) {
    assert.equal(isRelevantArticle({ ...article(shopClassified), sourceName: "Acuité" }, country("GF"), feed(key), { lookbackDays: 14 }, now), false, key);
    assert.equal(isRelevantArticle({ ...article("Une entreprise reprend un magasin d'optique en Guyane"), sourceName: "Acuité" }, country("GF"), feed(key), { lookbackDays: 14 }, now), true, key);
  }
});

test("French business fallback finds service-company reporting without treating society as business", () => {
  const plans = searchPlans(country("GF"), feed("business"));
  assert.equal(plans.length, 3);
  assert.equal(plans[1].lookbackDays, 14);
  assert.match(plans[1].query, /"entreprise"/);
  assert.equal(relevant("GF", "business", serviceCompany), true);
  assert.equal(relevant("GF", "business", "La société guyanaise rend hommage aux familles en deuil"), false);
  assert.equal(relevant("GF", "business", "Une société d'événementiel ouvre en Martinique"), false);
  assert.equal(isRelevantArticle(article(serviceCompany, now - 15 * 86400000), country("GF"), feed("business"), plans[1], now), false);
});

test("Economy Bolivia display alias cannot restore the same misdated archives", () => {
  for (const title of [economyAliasCorridor, "Camacho asume la embajada en Paraguay con una agenda centrada en comercio e inversiones"]) {
    for (const sourceName of ["Economy Bolivia", "ECONOMY BOLIVIA"]) {
      for (const key of ["top", "latest", "business", "world"]) {
        assert.equal(isRelevantArticle({ ...article(title), sourceName }, country("PY"), feed(key), { lookbackDays: 14 }, now), false, `${sourceName}/${key}`);
      }
    }
    assert.equal(isRelevantArticle({ ...article(title), sourceName: "Independent News" }, country("PY"), feed("business"), { lookbackDays: 14 }, now), true);
  }
});

test("TNT standings and dated match trackers are not news reports", () => {
  for (const title of [leagueTable, liveMatch, "Suriname Major League Table & Standings - Football Rankings"]) {
    for (const key of ["top", "latest", "sports"]) {
      assert.equal(isRelevantArticle({ ...article(title), sourceName: "TNT Sports" }, country("SR"), feed(key), { lookbackDays: 14 }, now), false, `${title}/${key}`);
    }
  }
  assert.equal(isRelevantArticle({ ...article("Suriname football club wins final after late goal"), sourceName: "TNT Sports" }, country("SR"), feed("sports"), { lookbackDays: 14 }, now), true);
});

test("FotMob minutes-played season profiles are not dated reporting", () => {
  for (const key of ["top", "latest", "sports"]) {
    assert.equal(isRelevantArticle({ ...article(playerStats), sourceName: "FotMob" }, country("TT"), feed(key), { lookbackDays: 14 }, now), false, key);
  }
  assert.equal(isRelevantArticle({ ...article("Trinidad and Tobago football captain returns after injury"), sourceName: "FotMob" }, country("TT"), feed("sports"), { lookbackDays: 14 }, now), true);
  assert.equal(relevant("TT", "sports", "Trinidad and Tobago football captain leads team in minutes played"), true);
});

test("Economy Bolivia recrawled archives need original publication dates before inclusion", () => {
  for (const sourceName of ["economy.com.bo", "www.economy.com.bo", "Economy.com.bo", "Economy"]) {
    for (const key of feedConfigs.map(f => f.key)) {
      assert.equal(isRelevantArticle({ ...article(recrawledEconomy), sourceName }, country("BO"), feed(key), { lookbackDays: 14 }, now), false, `${sourceName}/${key}`);
    }
    assert.equal(isRelevantArticle({ ...article("CBN, Farmacop, Sofía, Embol y Tigo lideran el ranking de las empresas con mejor reputación de Bolivia en 2022"), sourceName }, country("BO"), feed("business"), { lookbackDays: 14 }, now), false);
    assert.equal(isRelevantArticle({ ...article("Economy cumple 8 años consolidando el ecosistema de información económica y empresarial de mayor influencia en Bolivia"), sourceName }, country("BO"), feed("top"), { lookbackDays: 14 }, now), false);
  }
  assert.equal(isRelevantArticle({ ...article("Bolivia y Paraguay plantean corredor de 1.222 kilómetros para ampliar el comercio y la conexión con el Atlántico"), sourceName: "Economy" }, country("PY"), feed("business"), { lookbackDays: 14 }, now), false);
  assert.equal(isRelevantArticle({ ...article("Bolivia anuncia nuevas inversiones empresariales"), sourceName: "Economy News" }, country("BO"), feed("business"), { lookbackDays: 14 }, now), true);
});

test("AGMER Uruguay is an Argentine union branch and needs independent Uruguayan evidence", () => {
  for (const key of ["top", "latest", "crime"]) {
    assert.equal(relevant("UY", key, agmerUruguay), false, key);
    assert.equal(relevant("UY", key, "AGMER Seccional Uruguay exige justicia por Nancy Godoy"), false, key);
    assert.equal(relevant("UY", key, `${agmerUruguay}; sindicatos de Uruguay acompañan el reclamo`), true, key);
  }
  assert.equal(relevant("UY", "crime", "Sindicatos uruguayos exigen justicia por una docente"), true);
});

test("civil and investor-state arbitration require independent criminal evidence", () => {
  for (const [id, title] of [
    ["UY", civilArbitration],
    ["UY", "Justicia francesa ratificó el fallo a favor de Uruguay en el millonario caso Aratirí"],
    ["UY", "Justicia internacional dio la razón a Uruguay en el litigio por Aratirí"],
    ["BR", "Justiça do Brasil confirma sentença de arbitragem comercial"],
    ["GF", "Guyane: la justice confirme la décision en arbitrage commercial"],
    ["GY", "Guyana court confirms commercial arbitration award"],
    ["GY", "Guyana civil court resolves property dispute"],
    ["SR", "Suriname justitie behandelt arbitrage"]
  ]) {
    assert.equal(relevant(id, "crime", title), false, title);
    assert.equal(relevant(id, "crime", `${title}: corruption investigation leads to arrests`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
  assert.equal(relevant("UY", "crime", "Justicia de Uruguay condena a un acusado de homicidio"), true);
  assert.equal(relevant("UY", "business", "Inversores de Aratirí reclaman indemnización a Uruguay por sus inversiones"), true);
});

test("police games and medals need independent crime evidence", () => {
  for (const [id, title] of [
    ["DO", policeGames], ["BR", "Polícia do Brasil conquista medalhas nos jogos mundiais"],
    ["GY", "Guyana police win medals at world games"], ["GF", "Police de Guyane remporte des médailles aux jeux mondiaux"],
    ["SR", "Politie Suriname wint medailles bij de wereldspelen"]
  ]) {
    assert.equal(relevant(id, "crime", title), false, title);
    assert.equal(relevant(id, "crime", `${title}: corruption investigation leads to arrests`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
});

test("bank statistics tables are not news and the banking centre name is not world affairs", () => {
  const table = { ...article(bankTable), sourceName: "Finanzas Digital" };
  for (const key of feedConfigs.map(f => f.key)) {
    assert.equal(isRelevantArticle(table, country("PA"), feed(key), { lookbackDays: 14 }, now), false, key);
  }
  assert.equal(isRelevantArticle({ ...table, title: "Ingresos de Operaciones — Panamá — Situación No Consolidado — Centro Bancario Internacional" }, country("PA"), feed("business"), { lookbackDays: 14 }, now), false);
  const report = "Panamá anuncia inversiones en el Centro Bancario Internacional";
  assert.equal(relevant("PA", "business", report), true);
  assert.equal(relevant("PA", "world", report), false);
  assert.equal(relevant("PA", "world", `${report}: acuerdo diplomático con embajadores`), true);
});

test("trailing credited publisher names cannot supply category evidence", () => {
  assert.equal(relevant("SV", "business", publisherCredit), false);
  assert.equal(relevant("SV", "crime", publisherCredit), true);
  assert.equal(relevant("SV", "top", publisherCredit), true);
  assert.equal(relevant("SV", "business", "El Salvador anuncia inversión empresarial | El Comercio"), true);
  assert.equal(relevant("SV", "business", "El comercio de El Salvador aumenta"), true);
});

test("hashtag-only captions are not article headlines", () => {
  for (const key of feedConfigs.map(f => f.key)) assert.equal(relevant("CL", key, hashtags), false, key);
  assert.equal(relevant("CL", "crime", "#Chile #justicia"), false);
  assert.equal(relevant("CL", "crime", "#EnVideo Chile investiga fraude"), true);
  assert.equal(relevant("CL", "crime", "#Chile investiga fraude"), true);
});

test("academic and agricultural congresses require independent political evidence", () => {
  for (const [id, title] of [
    ["UY", "Uruguay: Abren las inscripciones para el Congreso Latinoamericano de la Papa 2027"],
    ["UY", "Universidad Señor de Sipán fortalece su internacionalización en el 61 Congreso Internacional de CLADEA en Uruguay"],
    ["BR", "Brasil recebe congresso internacional de medicina"],
    ["GY", "Guyana hosts an international congress on medicine"]
  ]) {
    assert.equal(relevant(id, "politics", title), false, title);
    assert.equal(relevant(id, "politics", `${title}: government announces new policy`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
  assert.equal(relevant("UY", "politics", "Congreso de Uruguay debate nueva ley de educación"), true);
});

test("scientific competitions and industry conferences need independent world-affairs evidence", () => {
  for (const [id, title] of [
    ["VE", "II Congreso Internacional Porcino de Venezuela por la educación y producción nacional"],
    ["BR", "Jovens baianos buscam patrocínio para representar o Brasil em competição internacional de inovação na França"],
    ["CL", "Estudiantes de Ovalle representarán a Chile en feria científica internacional en Nueva York"],
    ["CL", "realiza Jornada de Investigación e Innovación Responsable con conferencia internacional sobre comunicación científica - Universidad Autónoma de Chile"],
    ["CL", "Pocas veces se ha visto algo así en Chile: el lugar de Santiago que logró importante reconocimiento internacional"]
  ]) {
    assert.equal(relevant(id, "world", title), false, title);
    assert.equal(relevant(id, "world", `${title}: diplomatic agreement with ambassadors`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
  assert.equal(relevant("CL", "world", "Chile anuncia reconocimiento diplomático de un nuevo Estado"), true);
});

test("international fight nights and shows need independent world-affairs evidence", () => {
  for (const title of [
    '¡Histórico retorno a Chile! "La Jaula" Bahamondes y Colby Covington lideran velada internacional',
    "Reconocida estrella internacional reveló por error el día exacto de su show en Lollapalooza Chile",
    "Reconocida guitarrista internacional llega a Chile con evento gratuito: cómo participar por entradas",
    "HYPE Internacional Chile 2026 | Ignacio Bahamondes vs. Colby Covington en Santander Arena",
    "Edelaysen ejecutará mejoras en red eléctrica del sector Camino Internacional de Chile Chico"
  ]) {
    assert.equal(relevant("CL", "world", title), false, title);
    assert.equal(relevant("CL", "world", `${title}: diplomatic talks with ambassadors`), true, title);
    assert.equal(relevant("CL", "top", title), true, title);
  }
});

test("international alone cannot turn products, retail or generic services into world affairs", () => {
  for (const [id, title] of [
    ["CL", "Uno de los autos más vendidos en Chile obtiene cero estrellas en prueba internacional de seguridad"],
    ["PA", "Martín Pescador abre su primera tienda internacional en Panamá y lanza línea femenina"],
    ["PA", "Anati adopta modelo internacional para modernizar la información catastral en Panamá"],
    ["BR", "Brasil recebe novo serviço internacional"], ["GF", "Nouveau service international en Guyane"],
    ["SR", "Suriname krijgt een internationale dienst"], ["GY", "Guyana introduces a new international service"]
  ]) {
    assert.equal(relevant(id, "world", title), false, title);
    assert.equal(relevant(id, "world", `${title}: diplomatic agreement with ambassadors`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
});

test("explicit international affairs and independently reviewed cooperation remain eligible", () => {
  for (const [id, title] of [
    ["CL", "Chile se suma a la alianza internacional OceanEye para proteger los océanos"],
    ["EC", "Ecuador firma un acuerdo internacional para proteger tiburones"],
    ["BR", "Imprensa internacional destaca eleições no Brasil"],
    ["GY", "Guyana signs an international treaty"],
    ["CL", "Amnistía Internacional cuestiona condenas en Chile"],
    ["CO", "Estudiantes mexicanos realizan misión académica internacional en Colombia"]
  ]) assert.equal(relevant(id, "world", title), true, title);
  assert.equal(isRelevantArticle({ ...article("Un gran triunfo internacional en los cielos chilenos"), sourceName: "Pressenza" }, country("CL"), feed("world"), { lookbackDays: 14 }, now), true);
});

test("recrawled commodity data profiles are not dated business news", () => {
  for (const key of ["top", "latest", "business"]) {
    assert.equal(relevant("NI", key, tradeProfile), false);
    assert.equal(relevant("NI", key, "Tractores con ruedas en el Comercio de Nicaragua | Observatorio de Complejidad Económica"), false);
  }
  assert.equal(relevant("NI", "business", "Nicaragua aumenta comercio de cacao según el Observatorio de Complejidad Económica"), true);
  assert.equal(relevant("NI", "business", "Inversión en el comercio de Nicaragua aumenta este año"), true);
});

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
    ["DO", "Policía Nacional Dominicana rinde honores a agentes Caídos en el día de San Judas Tadeo. Otras Noticias Policiales"],
    ["GY", policeSport], ["CO", "Honor a quienes sirvieron a Colombia: Policía Nacional exalta el legado de los veteranos"],
    ["GY", "New Era Entertainment 20th ExxonMobil Guyana Futsal kicks off tonight at Retrieve Hard Court in Linden"],
    ["BR", "Polícia do Brasil homenageia veteranos"], ["GF", "Police de Guyane rend hommage aux vétérans"],
    ["SR", "Politie Suriname organiseert voetbal voor jongeren"]
  ]) {
    assert.equal(relevant(id, "crime", title), false, title);
    assert.equal(relevant(id, "crime", `${title}: fraud investigation leads to arrests`), true, title);
    assert.equal(relevant(id, "top", title), true, title);
  }
  assert.equal(relevant("GY", "crime", "Guyana police arrest youth academy coach for fraud"), true);
});

test("recrawled live-score databases cannot become fresh news through police team names", () => {
  const title = "Guyana Defence Force FC vs Guyana Police Force FC live score, H2H and lineups";
  for (const key of ["top", "latest", "sports", "crime"]) assert.equal(relevant("GY", key, title), false);
  assert.equal(relevant("GY", "crime", "Guyana Police Force FC coach arrested for fraud"), true);
  assert.equal(relevant("GY", "sports", "Guyana Police Force FC wins football final"), true);
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
    ["GT", "Elogio Internacional Para Guatemala Por Su Histórica Vuelta Ciclística"],
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

test("the observed standalone leak-video caption is not reporting", () => {
  for (const key of feedConfigs.map(f => f.key)) {
    assert.equal(relevant("TT", key, leakVideoCaption), false, key);
    assert.equal(relevant("TT", key, "FILTRACION Tobago Taxi Driver Viral Video!"), false, key);
  }
  for (const title of [
    "Trinidad and Tobago police investigate leaked taxi driver video",
    "Tobago taxi driver viral video leads to police investigation"
  ]) assert.equal(relevant("TT", "crime", title), true, title);
  assert.equal(isRelevantArticle({ ...article("Trinidad and Tobago signs port cooperation agreement"), sourceName: "Port of Rotterdam" }, country("TT"), feed("world"), { lookbackDays: 14 }, now), true);
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
    ["GF", "business", shopClassified, serviceCompany],
    ["PY", "business", economyAliasCorridor, "Paraguay anuncia nuevas inversiones empresariales"],
    ["SR", "sports", leagueTable, "Suriname football club wins final"],
    ["SR", "sports", liveMatch, "Suriname football club wins final"],
    ["TT", "latest", leakVideoCaption, "Trinidad and Tobago police investigate leaked taxi driver video"],
    ["TT", "latest", playerStats, "Trinidad and Tobago football captain returns"],
    ["BO", "business", recrawledEconomy, "Bolivia anuncia nuevas inversiones empresariales"],
    ["UY", "crime", agmerUruguay, "Uruguay investiga fraude"],
    ["UY", "crime", civilArbitration, "Uruguay investiga fraude"],
    ["UY", "politics", "Uruguay: Abren las inscripciones para el Congreso Latinoamericano de la Papa 2027", "Gobierno de Uruguay anuncia nueva política"],
    ["VE", "world", "II Congreso Internacional Porcino de Venezuela", "Venezuela firma acuerdo diplomático"],
    ["CL", "world", "Chile prepara velada internacional", "Chile firma acuerdo diplomático"],
    ["PA", "world", "Panamá abre tienda internacional", "Panamá firma acuerdo diplomático"],
    ["DO", "crime", policeGames, "República Dominicana investiga fraude"],
    ["SV", "business", publisherCredit, "El Salvador anuncia inversiones empresariales"],
    ["CL", "crime", hashtags, "Chile investiga fraude"],
    ["PA", "world", bankTable, "Panamá firma acuerdo diplomático"],
    ["PA", "business", bankTable, "Panamá anuncia inversiones empresariales"],
    ["GT", "crime", spam, "Guatemala police arrest a murder suspect"],
    ["GF", "politics", geography, "Guyane : le gouvernement annonce un budget pour Cayenne"],
    ["AR", "business", diplomat, "Argentina anuncia nuevas inversiones empresariales"],
    ["NI", "business", tradeProfile, "Nicaragua anuncia nuevas inversiones empresariales"]
  ]) {
    const items = [bad, good].map(title => ({ ...article(title, Date.now()), sourceName: sourceFor(title) }));
    const xml = `<rss><channel>${items.map(a => `<item><title>${a.title.replaceAll("&", "&amp;")}</title><link>${a.url}</link><source>${a.sourceName}</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`;
    const result = await fetchArticlesForFeed(country(id), feed(key), { sleep: async () => {}, fetchImpl: async () => new Response(xml) });
    assert.deepEqual(result.map(a => a.title), [good]);
    assert.equal(result[0].publishedAt, items[1].publishedAt);
  }
});

test("cached recovery cannot restore newly identified spam or semantic errors", async t => {
  for (const [id, key, bad] of [
    ["GF", "business", shopClassified],
    ["PY", "business", economyAliasCorridor], ["SR", "sports", leagueTable],
    ["SR", "sports", liveMatch], ["TT", "latest", playerStats], ["TT", "latest", leakVideoCaption],
    ["BO", "business", recrawledEconomy], ["UY", "crime", agmerUruguay], ["UY", "crime", civilArbitration],
    ["UY", "politics", "Uruguay: Abren las inscripciones para el Congreso Latinoamericano de la Papa 2027"],
    ["VE", "world", "II Congreso Internacional Porcino de Venezuela"],
    ["CL", "world", "Chile prepara velada internacional"],
    ["PA", "world", "Panamá abre tienda internacional"],
    ["DO", "crime", policeGames], ["SV", "business", publisherCredit],
    ["CL", "crime", hashtags], ["PA", "world", bankTable], ["PA", "business", bankTable],
    ["GT", "crime", spam], ["GF", "politics", geography], ["PR", "crime", resort],
    ["GY", "crime", policeSport], ["AR", "business", diplomat],
    ["BO", "culture", "Festival del Gato Andino y los Felinos de Bolivia"],
    ["MX", "world", "Aeropuerto Internacional de la Ciudad de México: vuelos demorados"],
    ["NI", "business", tradeProfile]
  ]) {
    const destination = await mkdtemp(path.join(tmpdir(), "latam-editorial-cache-"));
    t.after(() => rm(destination, { recursive: true, force: true }));
    const options = { destination, countries: [country(id)], feeds: [feed(key), feed("top")] };
    await generateFeeds({ ...options, fetchFeed: async () => [{ ...article(bad, Date.now()), sourceName: sourceFor(bad) }] });
    await generateFeeds({ ...options, fetchFeed: async (_, f) => f.key === key ? [] : [article(`${country(id).name} news`, Date.now())] });
    const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json")));
    assert.equal(manifest.countries[0].feeds[key].count, 0);
    assert.equal(manifest.countries[0].feeds[key].updatedAt, null);
  }
});
