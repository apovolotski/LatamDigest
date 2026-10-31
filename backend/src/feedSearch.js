// Search in the language used by local publishers. Country labels in the app
// remain English; they are not search terms or evidence of story relevance.
export const feedConfigs = [
  ["top", "Top"], ["latest", "Latest"], ["politics", "Politics"],
  ["business", "Business"], ["sports", "Sports"], ["tech", "Tech"],
  ["culture", "Culture"], ["crime", "Crime"], ["economy", "Economy"], ["world", "World"]
].map(([key, label]) => ({ key, label }));

const profiles = {
  AR: ["es", "Argentina", "argentin*"],
  BO: ["es", "Bolivia", "bolivi*"],
  BR: ["pt", "Brasil", "brasil*|brazil*"],
  CL: ["es", "Chile", "chile*|chileno*|chilena*"],
  CO: ["es", "Colombia", "colombi*"],
  CR: ["es", "Costa Rica", "Costa Rica|costarricense*|Costa Rican*"],
  CU: ["es", "Cuba", "cuba*"],
  DO: ["es", "República Dominicana", "República Dominicana|dominican*"],
  EC: ["es", "Ecuador", "ecuador*|ecuatorian*"],
  GT: ["es", "Guatemala", "guatemal*"],
  HN: ["es", "Honduras", "Honduras|hondureñ*|honduran*"],
  MX: ["es", "México", "mexic*"],
  NI: ["es", "Nicaragua", "nicaragua*|nicaragüense*"],
  PA: ["es", "Panamá", "panam*"],
  PY: ["es", "Paraguay", "paragua*"],
  PE: ["es", "Perú", "peru*"],
  PR: ["es", "Puerto Rico", "Puerto Rico|puertorriqueñ*|boricua*|Puerto Rican*"],
  SV: ["es", "El Salvador", "El Salvador|salvadoreñ*|salvadoran*"],
  UY: ["es", "Uruguay", "urugua*"],
  VE: ["es", "Venezuela", "venez*"],
  TT: ["en", "Trinidad and Tobago", "Trinidad|Tobago|Trinidadian*|Tobagonian*|Trinbagonian*|T&T|TTOC|Port of Spain"],
  SR: ["nl", "Suriname", "surinam*|surinaam*|Paramaribo"],
  GY: ["en", "Guyana", "Guyana|Guyanese"],
  GF: ["fr", "Guyane", "Guyane|guyanais*|guyanaise*|French Guianese|French Guianan*|Cayenne|Kourou|Macouria|Matoury|Saint Laurent du Maroni"]
};

// Stems (*) are for headline matching only; queries use complete words.
const topics = {
  es: {
    politics: "política|gobierno|congreso|elecciones|presidente|parlamento",
    business: "negocios|empresas|comercio|inversión|industria|empresarial",
    sports: "deportes|fútbol|béisbol|torneo|selección|baloncesto",
    tech: "tecnología|innovación|informática|telecomunicaciones|inteligencia artificial|software|digital",
    culture: "cultura|música|cine|arte|libros|festival|teatro|literatura",
    crime: "crimen|policía|justicia|asesinato|violencia|delito|detenido|homicidio",
    economy: "economía|inflación|banco central|PIB|empleo|crecimiento|exportaciones|presupuesto",
    world: "diplomacia|relaciones exteriores|internacional|cancillería|política exterior|cooperación"
  },
  pt: {
    politics: "política|governo|congresso|eleições|presidente|parlamento",
    business: "negócios|empresas|comércio|investimento|indústria|empresarial",
    sports: "esportes|futebol|basquete|torneio|seleção|campeonato",
    tech: "tecnologia|inovação|informática|telecomunicações|inteligência artificial|software|digital",
    culture: "cultura|música|cinema|arte|livros|festival|teatro|literatura",
    crime: "crime|polícia|justiça|assassinato|violência|homicídio|preso",
    economy: "economia|inflação|banco central|PIB|emprego|crescimento|exportações|orçamento",
    world: "diplomacia|relações exteriores|internacional|chancelaria|política externa|cooperação"
  },
  fr: {
    politics: "politique|gouvernement|assemblée|élections|président|député",
    business: "entreprises|commerce|investissement|industrie|entrepreneurs|économique|entreprendre|comptables|production|implante",
    sports: "sport|football|basket|tournoi|championnat|volley",
    tech: "technologie|innovation|informatique|télécommunications|intelligence artificielle|numérique|spatial|Ariane",
    culture: "culture|musique|cinéma|art|livres|festival|théâtre|littérature",
    crime: "crime|police|justice|meurtre|violence|homicide|trafic",
    economy: "économie|inflation|banque centrale|PIB|emploi|croissance|exportations|budget|salaires|pétrole|carburant|diesel",
    world: "international|diplomatie|affaires étrangères|coopération|ambassadeur|frontière"
  },
  nl: {
    politics: "politiek|regering|parlement|verkiezingen|president|assemblee",
    business: "bedrijven|handel|investeringen|industrie|ondernemers|ondernemingen",
    sports: "sport|voetbal|basketbal|toernooi|kampioenschap|atletiek",
    tech: "technologie|innovatie|software|telecom|kunstmatige intelligentie|digitaal",
    culture: "cultuur|muziek|film|kunst|boeken|festival|theater|literatuur",
    crime: "criminaliteit|politie|justitie|moord|geweld|misdaad|aangehouden",
    economy: "economie|inflatie|centrale bank|bbp|werkgelegenheid|groei|export|begroting",
    world: "internationaal|diplomatie|buitenlandse zaken|samenwerking|buitenland"
  },
  en: {
    politics: "politics|government|congress|election|president|parliament",
    business: "business|company|companies|trade|investment|industry|entrepreneurs",
    sports: "sports|football|soccer|cricket|tournament|basketball|championship",
    tech: "technology|innovation|computing|telecom|artificial intelligence|software|digital",
    culture: "culture|music|film|art|books|festival|theatre|literature",
    crime: "crime|police|court|murder|violence|homicide|arrested",
    economy: "economy|inflation|central bank|GDP|employment|growth|exports|budget",
    world: "foreign affairs|diplomacy|international|cooperation|foreign policy|diplomatic|ambassador|high commissioner|bilateral|foreign minister|CARICOM|United Nations"
  }
};

// Keep queries compact. Long OR expressions returned mostly historical results
// in live Google News probes even with when:Nd; dates are checked independently.
const queryTopics = {
  "en/world": "foreign affairs|diplomacy|ambassador|CARICOM|bilateral|United Nations",
  "fr/business": "entreprises|commerce|investissement|comptables|production|entreprendre",
  "fr/economy": "économie|emploi|budget|prix|pétrole|carburant",
  "fr/tech": "technologie|innovation|intelligence artificielle|numérique|spatial|Ariane"
};

// Inflections belong to one language AND category. Deriving a language-wide
// stem from "política exterior" made all domestic politics pass as World news.
// Keep stems bounded: art*/kunst* would match artificial intelligence, invest*
// would match investigation, and polici* would match English policies.
// These terms match headlines; queries continue to use complete words.
const topicMatchTerms = {
  "es/politics": "polític*|eleccio*|electoral*|parlament*|congres*|diputad*|senad*|presiden*|ministr*|votación",
  "es/business": "empresa*|comerci*|inversi*|industri*|negocio*|corporativ*",
  "es/sports": "deport*|futbol*|beisbol*|baloncest*|campeon*|bicampeon*|tenis*|tenista*|rugby|futsal|premundial|mundial femenino|mundial sub",
  "es/tech": "tecnolog*|innov*|informátic*|telecom*|digital*|ciber*|IA|robot*|5G|6G",
  "es/culture": "cultur*|music*|cineasta*|cinefil*|cinematograf*|artista*|artístic*|literar*|teatr*|conciert*|documental*|patrimonio",
  "es/crime": "criminal*|policia*|asesinat*|homicid*|femicid*|feminicid*|detenid*|delit*|delincuen*|corrup*|narcotraf*",
  "es/economy": "econom*|inflacion*|export*|presupuest*|desempleo|arancel*|salarial*",
  "es/world": "internacional*|diplomat*|embajad*|consulad*|canciller*|bilateral*|relaciones internacionales|consultas políticas|ONU|OTAN|UNESCO",
  "pt/politics": "polític*|eleiç*|eleitor*|parlament*|deputad*|senad*|presiden*|ministr*|voto*",
  "pt/business": "empresa*|comerci*|investidor*|investimento*|industri*|negócio*|corporativ*",
  "pt/sports": "esport*|futebol*|basquet*|campeon*|atlet*|rúgbi|rugby|futsal|copa do brasil|copa do mundo|copa américa",
  "pt/tech": "tecnolog*|inova*|informátic*|telecom*|digital*|digitais|ciber*|IA|robot*|5G|6G",
  "pt/culture": "cultur*|musica*|cinema*|artista*|artístic*|literári*|teatr*|concerto*|documentári*|patrimônio",
  "pt/crime": "criminal*|criminos*|policia*|assassin*|homicid*|feminicid*|presa|preso|prisão|prisões|detid*|corrup*|trafic*",
  "pt/economy": "econom*|inflaç*|export*|orçament*|desemprego|tarifa*|salarial*",
  "pt/world": "internaciona*|diplomat*|embaixad*|consulad*|chanceler*|bilatera*|relações internacionais|ONU|OTAN|UNESCO",
  "fr/politics": "politiqu*|gouvernement*|parlement*|électora*|déput*|présiden*|sénat*|minist*",
  "fr/business": "entreprise*|entrepreneur*|commerc*|investiss*|industri*|comptabl*",
  "fr/sports": "sport*|football*|basket*|tournoi*|champion*|athlét*|rugby*|futsal|tennis|handball|cyclis*",
  "fr/tech": "technolog*|innovat*|informatiqu*|informaticien*|télécom*|numériqu*|cyber*|IA|robot*|5G|6G|réseaux mobiles",
  "fr/culture": "culturel*|culturelle*|musical*|musicien*|cinéma*|artiste*|artistiqu*|littérair*|littératur*|théâtr*|opéra*|concert*|documentaire*|patrimoine",
  "fr/crime": "crimin*|policier*|judici*|assassin*|homicid*|violent*|interpell*|corrupt*|trafic*",
  "fr/economy": "économ*|export*|inflation*|budgétair*|pétrol*|salarial*|chômage",
  "fr/world": "internationa*|diplomat*|ambassad*|consulat*|bilatéra*|relations internationales|frontali*|ONU|OTAN|UNESCO",
  "nl/politics": "politiek*|regering*|parlement*|verkiezing*|presiden*|minister*|kabinet*",
  "nl/business": "bedrijf*|bedrijv*|handels*|invester*|investeer*|industri*|ondernemer*|onderneming*",
  "nl/sports": "sport*|voetbal*|basketbal*|toernooi*|kampioen*|atlet*|rugby*|futsal|tennis",
  "nl/tech": "technolog*|innovat*|digita*|telecom*|cyber*|informatica*|AI|robot*|5G|6G",
  "nl/culture": "cultureel|culturele|muziek*|muzik*|film*|bioscoop*|cinema|concert*|documentaire*|kunsten|kunstenaar*|kunstenar*|artiest*|artistiek*|theater*|literair*|erfgoed",
  "nl/crime": "crimi*|justiti*|moord*|misdrijf*|aangehoud*|arrestatie*|corrupt*|cocaïne|drug*|politieagent*|politiebureau*|politieonderzoek*",
  "nl/economy": "econom*|inflati*|export*|begrot*|werkgelegen*|centrale bank*|groeicijfers",
  "nl/world": "internationa*|diplomat*|ambassad*|consulaat*|bilatera*|verdrag*|buitenlandse betrekkingen|VN|NAVO|UNESCO",
  "en/politics": "politic*|parliament*|congress*|presiden*|electoral|legislat*|prime minister|PM|senator*",
  "en/business": "industr*|firm*|commercial|commerce|investor*|investment*|corporat*|entrepreneur*",
  "en/sports": "sport*|football*|basketball*|champion*|athlet*|rugby*|futsal|tennis|touchdown*",
  "en/tech": "technolog*|innovat*|telecom*|cyber*|AI|broadband|robot*|5G|6G|data centre|data center",
  "en/culture": "cultural|music*|artist*|cinema*|concert*|documentar*|heritage|literar*|theatr*|carnival*|cuisine|culinary",
  "en/crime": "criminal*|arrest*|detain*|violent*|homicid*|corrupt*|robber*|fraud*|kidnap*|traffick*|femicide*",
  "en/economy": "econom*|inflation*|export*|unemployment|recession|tariff*|interest rates",
  "en/world": "diplomat*|ambassador*|envoy*|embass*|consular|consulate*|bilateral*|treaty|treaties|UNESCO|NATO"
};

// Remove known people/place names before looking for country evidence. A real
// country reference elsewhere in the same headline still qualifies the story.
const countryAmbiguities = {
  TT: /\btrinidad (?:jay )?chambliss\b|\btrinidad tidings\b/g,
  CU: /\bmark cuban\b/g,
  MX: /\bnew mexico\b/g,
  PA: /\bpanama city (?:beach )?florida\b/g,
  CL: /\b(?:green|red|hatch) chiles?\b|\bchile peppers?\b/g,
  UY: /\bconcepcion del uruguay\b/g,
  EC: /\b(?:alcanza|alcanzo|alcanzado|cruza|supera|llega a) (?:su|el) ecuador\b/g,
  PE: /\b(?:mercadito|barrio|calle|avenida) (?:la |el )?peru\b/g,
  SV: /\b(?:es|como|llamado|considerado) el salvador (?:de|del)\b/g
};

const honoraryAmbassadors = /\b(?:cultural|brand) ambassador\w*\b|\bembajador(?:a|es|as)? (?:de (?:la )?marca|cultural(?:es)?)\b|\bembaixador(?:a|es|as)? (?:(?:da|de) marca|cultura(?:l|is))\b|\bambassad(?:eur|rice)s? (?:de marque|culturel(?:le)?s?)\b|\b(?:cultureel|culturele) ambassadeur\b/g;
const weakWorldTerms = new Set(["international", "internacional", "internationaal", "internacional*", "internaciona*", "internationa*"]);
const entertainmentTerms = "gira|tour|tournee|tournée|turnê|pageant|miss|beauty|belleza|beleza|festival|concert*|conciert*|concerto*|carnival*|carnaval*|muziek*|music*|musica*|musical*|film*|cinema*".split("|");
const cooperationTerms = new Set(["cooperación", "cooperação", "coopération", "samenwerking", "cooperation"]);
const regionNames = ["es", "pt", "fr", "nl", "en"].map(language => new Intl.DisplayNames(language, { type: "region" }));
const translatedCountries = Object.fromEntries(Object.keys(profiles).map(id => [id, regionNames.map(names => names.of(id))]));
// Explicitly domestic cooperation needs independent international evidence.
// Do not require a closed list of foreign names for all cooperation reporting:
// international partners may also be cities, institutions or named officials.
const externalPartners = "Spain|España|Espanha|Spanje|Espagne|France|Francia|França|Frankrijk|Germany|Alemania|Alemanha|Allemagne|Duitsland|China|Japan|Japón|Japão|Japon|Taiwan|Taiwán|Canada|Canadá|United States|Estados Unidos|États Unis|Verenigde Staten|USA|EUA|EEUU|Florida|United Kingdom|Reino Unido|Royaume Uni|Verenigd Koninkrijk|Netherlands|Países Bajos|Pays Bas|Nederland|Indonesia|Indonesië|Indonésie|India|Russia|Rusia|Russie|Rússia|Korea|Corea|Corée|Camboya|Cambodia|Cambodge|Italy|Italia|Italie|Portugal|Israel|Israël|Jamaica|Curaçao|Curacao|Martinique|Guadeloupe|Benelux|European Union|Unión Europea|União Europeia|Union européenne|Europese Unie".split("|");
const sportingEventTerms = "FIFA|UEFA|CONMEBOL|world cup|copa mundial|copa del mundo|copa do mundo|coupe du monde|wereldbeker".split("|");
const domesticCooperation = /\b(?:local(?:es)?|locais|lokale|municip\w*|provinc\w*|interprovinc\w*)\b/;
const scienceFestival = /\b(?:neurocien\w*|neuroscien\w*|neurowetensch\w*)\b/;
const wildlifeFestival = /\b(?:gato andino|felinos|wildlife|biodiversidad|biodiversity|biodiversite|biodiversiteit)\b/;
const diplomaticBusinessTitles = /\b(?:encargad[oa]s? de negocios|encarregad[oa]s? de negocios|charges? d affaires)\b/g;
const noncriminalJustice = /\bjusticia (?:social|laboral|del trabajo)\b|\bjustica (?:social|do trabalho)\b|\bjustice (?:sociale|du travail)\b|\b(?:social|labour|labor) justice\b/g;
const weakCrimeTerms = new Set(["policía", "polícia", "police", "politie", "court", "policia*", "policier*", "politieagent*", "politiebureau*"]);
const policeCommunityEvents = /\b(?:youth academy|cricket|football|futbol|futebol|basketball|baloncesto|basquete|voetbal|rugby|athletics|honou?rs?|honra\w*|homenaje\w*|hommage\w*|exalta\w*|veteran\w*)\b/;
const nonWorldEvents = "amistoso*|friendly|amical*|pickleball|libro*|livro*|livre*|book*|boeken|premio*|prize*|award*|concurs*|competition*|queso*|cheese|kaas|fromage|gastronom*".split("|");
const internationalAirport = /\b(?:aeropuerto|aeroporto|aeroport) internacional\b|\baeroport international\b|\binternational airport\b|\binternationale luchthaven\b/g;
// Promotional exploit/spam headlines are not reporting about sexual crimes.
// Require the promotion pattern, preserving legitimate investigations/coverage.
const explicitVideoPromotion = /\bfull sex videos?\b|\bsex videos? on (?:hd|hq)\b|\b(?:xnxx|xvideos|pornhub)\b.*\b(?:full|clip|hd|hq)\b/;
const schoolContext = /\b(?:escuela\w*|escolar\w*|estudiante\w*|escola\w*|estudante\w*|ecole\w*|scolaire\w*|eleve\w*|school\w*|student\w*|leerling\w*)\b/;
const genericBooks = new Set(["libros", "livros", "livres", "boeken", "books"]);
const booksAsPolicyMetaphor = /\barmas (?:y )?no libros\b|\barmas (?:e )?nao livros\b|\b(?:guns|arms) (?:and )?not books\b|\barmes (?:et )?pas (?:de )?livres\b|\bwapens (?:en )?geen boeken\b/g;

// Workplace/organizational "culture" is not arts or cultural heritage. Remove
// only that phrase so independent cultural reporting in the title still counts.
const figurativeCulture = /\b(?:safety|security|workplace|corporate|organizational|organisational|compliance) culture\b|\bculture of (?:safety|security|compliance|corruption|violence)\b|\bcultura (?:de |da |do )?(?:seguridad|seguranca|empresarial|organizacional|corporativa|corrupcion|corrupcao|violencia)\b|\bculture (?:de |d |du |des |la )*(?:securite|entreprise|organisationnelle|corruption|violence)\b|\b(?:veiligheids|bedrijfs|organisatie|bestuurs)cultuur\b|\bcultuur van (?:veiligheid|corruptie|geweld)\b/g;
const financialOrPreventiveCulture = /\b(?:savings|investment|financial|tax|prevention) culture\b|\bculture of (?:saving|savings|investment|investing|prevention)\b|\bcultura (?:de |da |do )?(?:ahorro|inversion|investimento|financiera|financeira|tributaria|fiscal|prevencion|poupanca|prevencao)\b|\bculture (?:de |d |du |des |la |l )*(?:epargne|investissement|financiere|fiscale|prevention)\b|\b(?:spaar|beleggings|investerings|preventie)cultuur\b|\bcultuur van (?:sparen|beleggen|investeren|preventie)\b/g;

const cultureSearchAliases = {
  GY: '("Guyana" OR "Guyanese")',
  TT: '("Trinidad and Tobago" OR "Tobago")'
};

function normalized(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}*]+/gu, " ").trim();
}
function matches(text, term) {
  const value = ` ${normalized(text)} `;
  const word = normalized(term);
  if (word.endsWith("*")) return value.includes(` ${word.slice(0, -1)}`);
  // "congress" is not a plural of French "congrès" (a conference).
  return [word, `${word}s`, ...(word.endsWith("s") && !word.endsWith("ss") ? [word.slice(0, -1)] : [])]
    .some(form => value.includes(` ${form} `));
}
const quoted = value => `"${value}"`;

export function searchPlans(country, feed) {
  const profile = profiles[country.id];
  if (!profile) throw new Error(`No search profile for country ${country.id}`);
  const [language, name] = profile;
  const headline = ["top", "latest"].includes(feed.key);
  const days = headline ? [3, 7] : [7, 14];
  const countryQuery = country.id === "TT" ? '("Trinidad and Tobago" OR "Tobago")' : quoted(name);
  const plans = days.map(lookbackDays => ({ language, lookbackDays, countryQuery }));
  if (language !== "en") plans.push({ language: "en", lookbackDays: days[1], countryQuery: quoted(country.name) });
  const searches = plans.map((plan, index) => {
    const terms = headline ? [] : (queryTopics[`${plan.language}/${feed.key}`] ?? topics[plan.language][feed.key]).split("|");
    // The widened local search must also try vocabulary previously truncated
    // from every query, such as teatro/literatura or detenido/homicidio.
    const rotated = index === 1 ? [...terms.slice(6), ...terms.slice(0, 6)] : terms;
    return { ...plan,
      query: `${plan.countryQuery}${headline ? "" : ` (${rotated.slice(0, 6).map(quoted).join(" OR ")})`} when:${plan.lookbackDays}d`,
      locale: localeFor(country.id, plan.language)
    };
  });
  // English profiles have no language fallback. A third bounded arts/heritage
  // search also uses explicit national demonyms; broad "culture" searches can
  // otherwise yield only workplace-safety stories in a sparse category.
  if (language === "en" && feed.key === "culture") {
    const countryQuery = cultureSearchAliases[country.id];
    searches.push({ language, lookbackDays: 14, countryQuery,
      query: `${countryQuery} ("heritage" OR "cuisine" OR "culinary" OR "artists" OR "museum" OR "cultural") when:14d`,
      locale: localeFor(country.id, language) });
  }
  return searches;
}

function localeFor(countryCode, language) {
  if (language === "pt") return { hl: "pt-BR", gl: "BR", ceid: "BR:pt-BR" };
  if (language === "fr") return { hl: "fr", gl: "FR", ceid: "FR:fr" };
  if (language === "nl") return { hl: "nl", gl: "NL", ceid: "NL:nl" };
  if (language === "en") return { hl: "en-US", gl: "US", ceid: "US:en" };
  return { hl: "es-419", gl: countryCode, ceid: `${countryCode}:es-419` };
}

export function isRelevantArticle(article, country, feed, plan, now = Date.now()) {
  const published = Date.parse(article.publishedAt);
  if (!Number.isFinite(published) || published < now - plan.lookbackDays * 86_400_000 || published > now + 3600_000) return false;
  if (explicitVideoPromotion.test(normalized(article.title))) return false;
  // Google can assign a recent crawl date to evergreen sports database pages.
  // Country and sports keywords do not turn standings/statistics into news.
  if (/\b(?:records (?:and )?stats|standings history|games standings squad|schedule for the international football season)\b|\blive score\b.*\bh2h\b.*\blineups\b/.test(normalized(article.title))) return false;
  // OEC's commodity/country profiles are reusable trade databases, not dated
  // news. A recent RSS crawl cannot establish original publication. Match the
  // profile template only, retaining reporting that cites OEC statistics.
  if (/\b(?:en el comercio de|in the trade of)\b.*\b(?:observatorio de complejidad economica|observatory of economic complexity)\b/.test(normalized(article.title))) return false;
  // Verified Guatemala.com event listings and laprensa.hn archive stories
  // received new RSS crawl dates despite original publication in 2014/2016,
  // 2018/2025 and March/early October 2026.
  // The RSS does not distinguish those crawl timestamps from original dates,
  // even for undated titles. Quarantine this source until original publication
  // dates can be verified; do not guess dates or pad feeds with old material.
  if (["guatemala com", "www laprensa hn", "laprensa hn"].includes(normalized(article.sourceName ?? ""))) return false;
  // The publisher dates this exact report 12 December 2024, even though its
  // Google RSS crawl date is recent. Do not exclude new reporting on the actor.
  // https://www.televicentro.com/yimmi-rios-sigue-brillando-de-guardia-de-seguridad-a-estrella-del-cine-hondureno-2025-12-12
  if (normalized(article.sourceName ?? "") === "televicentro" &&
      normalized(article.title) === "yimi rios sigue brillando de guardia de seguridad a estrella del cine hondureno") return false;
  const [localLanguage, , aliases] = profiles[country.id];
  const countryTerms = `${aliases}|${country.name}`.split("|");
  let geographicTitle = normalized(article.title);
  if (countryAmbiguities[country.id]) geographicTitle = geographicTitle.replace(countryAmbiguities[country.id], " ");
  // Cayenne alone is weak evidence in a Porsche story; retain every other
  // explicit country/city/demonym, including English fallback demonyms.
  if (country.id === "GF" && /\b(porsche|taycan)\b/i.test(article.title)) geographicTitle = geographicTitle.replace(/\bcayenne\b/g, " ");
  // Some French headlines call the republic of Guyana "Guyane". Its capital,
  // president or former British name do not establish French Guiana coverage.
  if (country.id === "GF" && /\b(?:irfaan ali|georgetown|guyane britannique|guyana)\b/.test(geographicTitle) &&
      !/\b(?:guyane francaise|french guian\w*|cayenne|kourou|macouria|matoury|saint laurent du maroni|guyane et (?:le )?guyana|guyana et (?:la )?guyane)\b/.test(geographicTitle)) return false;
  // Puerto Rico is also a resort in Mogán, Gran Canaria. Keep independent
  // Puerto Rican/diaspora evidence rather than treating that resort as a nation.
  if (country.id === "PR" && /\b(?:mogan|policia canaria|gran canaria)\b/.test(geographicTitle)) geographicTitle = geographicTitle.replace(/\bpuerto rico\b/g, " ");
  if (!countryTerms.some(term => matches(geographicTitle, term))) return false;
  if (["top", "latest"].includes(feed.key)) return true;
  if (feed.key === "tech" && /world wide technology championship/i.test(article.title)) return false;
  const languages = [...new Set([localLanguage, "en"])];
  const terms = languages.flatMap(language => [
    ...topics[language][feed.key].split("|"),
    ...(topicMatchTerms[`${language}/${feed.key}`] ?? "").split("|").filter(Boolean)
  ]);
  let title = article.title;
  if (feed.key === "culture") {
    title = normalized(title).replace(figurativeCulture, " ").replace(financialOrPreventiveCulture, " ").replace(booksAsPolicyMetaphor, " ");
    // School administration/infrastructure is not literary coverage just
    // because schoolbooks are mentioned; retain independent arts evidence.
    if (schoolContext.test(title) && !terms.filter(term => !genericBooks.has(term)).some(term => matches(title, term))) return false;
    const sports = languages.flatMap(language => [...topics[language].sports.split("|"), ...(topicMatchTerms[`${language}/sports`] ?? "").split("|")]);
    // A sporting "festival" is not an arts festival. Preserve actual music,
    // cinema, heritage, etc. even when a title also discusses sport.
    if (([...sports, ...sportingEventTerms].some(term => matches(title, term)) || /\b(?:sub|under|u) \d{1,2}\b/.test(title) || scienceFestival.test(title) || wildlifeFestival.test(title)) &&
        !terms.filter(term => term !== "festival").some(term => matches(title, term))) return false;
  }
  if (feed.key === "business") title = normalized(title).replace(diplomaticBusinessTitles, " ");
  if (feed.key === "crime") {
    title = normalized(title).replace(noncriminalJustice, " ");
    const sports = languages.flatMap(language => [...topics[language].sports.split("|"), ...(topicMatchTerms[`${language}/sports`] ?? "").split("|")]);
    if ((policeCommunityEvents.test(title) || sports.some(term => matches(title, term))) &&
        !terms.filter(term => !weakCrimeTerms.has(term)).some(term => matches(title, term))) return false;
  }
  if (feed.key === "politics") title = normalized(title).replace(/\b\d{1,2}(?: \d{2})? pm\b/g, " ");
  if (feed.key === "world") {
    title = normalized(title).replace(honoraryAmbassadors, " ").replace(internationalAirport, " ");
    const domestic = domesticCooperation.test(title) || matches(title, `por ${profiles[country.id][1]}`);
    if (domestic && !terms.filter(term => !cooperationTerms.has(term)).some(term => matches(title, term))) {
      const otherCountries = Object.entries(profiles).filter(([id]) => id !== country.id)
        .flatMap(([id, profile]) => [...profile[2].split("|"), ...translatedCountries[id]]);
      if (![...otherCountries, ...externalPartners].some(term => matches(title, term))) return false;
    }
    const sports = languages.flatMap(language => [...topics[language].sports.split("|"), ...(topicMatchTerms[`${language}/sports`] ?? "").split("|")]);
    if ([...sports, ...entertainmentTerms, ...nonWorldEvents].some(term => matches(title, term)) &&
        !terms.filter(term => !weakWorldTerms.has(term)).some(term => matches(title, term))) return false;
  }
  if (feed.key === "sports" && /\bseleccion (?:de )?(?:jueces|magistrados|candidatos|personal)\b/.test(normalized(title))) return false;
  return terms.some(term => matches(title, term));
}
