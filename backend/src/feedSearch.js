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
  // The named national telecom event supplies country evidence. TATT alone
  // does not: it is also the ticker of an unrelated technology company.
  TT: ["en", "Trinidad and Tobago", "Trinidad|Tobago|Trinidadian*|Tobagonian*|Trinbagonian*|T&T|TTOC|Port of Spain|TT Spectrum Week"],
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
  // Puerto Rico's sparse world feed needs its English fallback to find UN
  // status hearings as well as diplomatic reporting. Retain three searches,
  // the country scope and the same date/relevance/publication-age gates.
  "PR/en/world": "foreign affairs|diplomacy|embassy|consulate|United Nations|decolonization",
  "en/world": "foreign affairs|diplomacy|ambassador|CARICOM|bilateral|United Nations",
  "fr/business": "entreprises|commerce|investissement|comptables|production|entreprendre|entreprise",
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
  // This commercial service-company phrase is bounded: société by itself
  // also means society and must not qualify general social coverage.
  "fr/business": "entreprise*|entrepreneur*|commerc*|investiss*|industri*|comptabl*|société d'événementiel",
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
  "en/tech": "technolog*|innovat*|telecom*|cyber*|AI|broadband|robot*|5G|6G|data centre|data center|radio spectrum|spectrum management|spectrum week|satellite connectivity",
  "en/culture": "cultural|music*|artist*|cinema*|concert*|documentar*|heritage|literar*|theatr*|carnival*|cuisine|culinary",
  "en/crime": "criminal*|arrest*|detain*|violent*|homicid*|corrupt*|robber*|fraud*|kidnap*|traffick*|femicide*",
  "en/economy": "econom*|inflation*|export*|unemployment|recession|tariff*|interest rates",
  // The named UN body is international affairs. Bare "un" and generic
  // decolonising curricula/arts are not equivalent evidence.
  "en/world": "diplomat*|ambassador*|envoy*|embass*|consular|consulate*|bilateral*|treaty|treaties|UNESCO|NATO|UN decolonization committee|UN decolonisation committee"
};

// Remove known people/place names before looking for country evidence. A real
// country reference elsewhere in the same headline still qualifies the story.
const countryAmbiguities = {
  TT: /\btrinidad (?:jay )?chambliss\b|\btrinidad tidings\b/g,
  CU: /\bmark cuban\b/g,
  MX: /\b(?:new|nuevo|novo|nieuw) mexico\b|\bnouveau mexique\b/g,
  PA: /\bpanama city (?:beach )?florida\b/g,
  CL: /\b(?:green|red|hatch) chiles?\b|\bchile peppers?\b/g,
  UY: /\b(?:concepcion del|agmer(?: seccional)?) uruguay\b/g,
  EC: /\b(?:alcanza|alcanzo|alcanzado|cruza|supera|llega a) (?:su|el) ecuador\b/g,
  PE: /\b(?:mercadito|barrio|calle|avenida) (?:la |el )?peru\b/g,
  SV: /\b(?:es|como|llamado|considerado) el salvador (?:de|del)\b/g
};

const honoraryAmbassadors = /\b(?:cultural|brand) ambassador\w*\b|\bembajador(?:a|es|as)? (?:de (?:la )?marca|cultural(?:es)?)\b|\bembaixador(?:a|es|as)? (?:(?:da|de) marca|cultura(?:l|is))\b|\bambassad(?:eur|rice)s? (?:de marque|culturel(?:le)?s?)\b|\b(?:cultureel|culturele) ambassadeur\b/g;
const weakWorldTerms = new Set(["international", "internacional", "internationaal", "internacional*", "internaciona*", "internationa*"]);
const entertainmentTerms = "guitarr*|guitar*|pianist*|violinist*|HYPE Internacional|velada*|show*|spectacle*|optreden*|UFC|MMA|gira|tour|tournee|tournée|turnê|pageant|miss|beauty|belleza|beleza|festival|concert*|conciert*|concerto*|carnival*|carnaval*|muziek*|music*|musica*|musical*|film*|cinema*".split("|");
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
// These festivals exhibit model aircraft or hold chess competitions. The
// reviewed Festival Internacional de Réplicas is an aeromodelling event;
// replicas in independent museum/arts reporting remain eligible.
const hobbyFestival = /\b(?:aeromodel\w*|festival internacional de replicas|ajedrez|xadrez|echecs|chess|schaak\w*)\b/;
const diplomaticBusinessTitles = /\b(?:encargad[oa]s? de negocios|encarregad[oa]s? de negocios|charges? d affaires)\b/g;
const noncriminalJustice = /\bjusticia (?:social|laboral|del trabajo)\b|\bjustica (?:social|do trabalho)\b|\bjustice (?:sociale|du travail)\b|\b(?:social|labour|labor) justice\b/g;
const weakCrimeTerms = new Set(["policía", "polícia", "police", "politie", "court", "policia*", "policier*", "politieagent*", "politiebureau*"]);
// Investor-state arbitration and civil/commercial courts do not establish a
// crime. Aratiri is the primary-reviewed investment dispute, not a criminal case.
const civilDispute = /\b(?:aratiri|arbitraje|arbitragem|arbitrage|arbitration)\b|\b(?:civil|commercial|labor|labour|employment) (?:court|litigation)\b|\b(?:justicia|justica|justice) (?:civil|civile|comercial|commerciale)\b/;
const civilJusticeTerms = new Set([...weakCrimeTerms, "justicia", "justiça", "justice", "justitie", "judici*", "justiti*"]);
const policeCommunityEvents = /\b(?:youth academy|world games|juegos mundiales|jogos mundiais|jeux mondiaux|wereldspelen|medals?|medall\w*|medalh\w*|medaill\w*|cricket|football|futbol|futebol|basketball|baloncesto|basquete|voetbal|rugby|athletics|honou?rs?|honores?|honra\w*|homenaje\w*|hommage\w*|exalta\w*|veteran\w*|aniversari\w*|anniversar\w*|anniversaire\w*|jubile\w*|ceremoni\w*)\b/;
const nonWorldEvents = "amistoso*|friendly|amical*|pickleball|competição*|competición*|feria científica|feira científica|science fair|comunicación científica|porcino*|importante reconocimiento internacional|libro*|livro*|livre*|book*|boeken|premio*|prize*|award*|concurs*|competition*|queso*|cheese|kaas|fromage|gastronom*".split("|");
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
    const terms = headline ? [] : (queryTopics[`${country.id}/${plan.language}/${feed.key}`] ??
      queryTopics[`${plan.language}/${feed.key}`] ?? topics[plan.language][feed.key]).split("|");
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
  // Sparse English tech feeds have no language fallback. Search a distinct,
  // bounded telecom vocabulary before the only cached story ages out. Keep
  // the country query and all headline, date and publication-age checks.
  if (language === "en" && feed.key === "tech") {
    searches.push({ language, lookbackDays: 14, countryQuery,
      query: `${countryQuery} ("spectrum" OR "cybersecurity" OR "broadband" OR "satellite" OR "5G" OR "robotics") when:14d`,
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
  // This observed standalone leak-video promotion supplies no news report.
  // Match the exact caption, leaving reporting about the incident eligible.
  if (/^filtracion tobago taxi driver viral video$/.test(normalized(article.title))) return false;
  // A caption made entirely of hashtags supplies no report, even when its
  // tags happen to contain a country and category. Keep tags alongside prose.
  if (article.title.includes("#") && !/\p{L}/u.test(article.title.replace(/#[\p{L}\p{N}\p{M}_]+/gu, ""))) return false;
  // The publisher's statistics tool shows historical quarterly bank tables,
  // not dated reporting. A fresh RSS crawl is not original publication proof.
  if (normalized(article.sourceName ?? "") === "finanzas digital" &&
      /^.+ panama situacion (?:no )?consolidado centro bancario internacional$/.test(normalized(article.title))) return false;
  // Google can assign a recent crawl date to evergreen sports database pages.
  // Country and sports keywords do not turn standings/statistics into news.
  if (/\b(?:records (?:and )?stats|standings history|games standings squad|schedule for the international football season)\b|\blive score\b.*\bh2h\b.*\blineups\b/.test(normalized(article.title))) return false;
  // These named publisher templates are standings, match trackers and player
  // statistics. Keep their news reports; a crawl date cannot date a database.
  if (normalized(article.sourceName ?? "") === "tnt sports" &&
      /\btable (?:football scores results fixtures|standings football rankings)$|\blive .+ football scores highlights \d{1,2} \d{1,2} \d{4}$/.test(normalized(article.title))) return false;
  if (normalized(article.sourceName ?? "") === "fotmob" &&
      /^minutes played .+ stats for .+ \d{4}(?: \d{4})?$/.test(normalized(article.title))) return false;
  // The named stock-analysis landing template is a changing company database,
  // not an individually dated news report. Keep the publisher's actual articles.
  if (normalized(article.sourceName ?? "") === "simply wall st" &&
      /^.+ \([A-Z0-9]+:[A-Z0-9.\-]+\)\s*[-–—]\s*Stock Analysis$/i.test(article.title)) return false;
  if (normalized(article.sourceName ?? "") === "futbolargentino com" &&
      /^.+ vs .+ en vivo torneo (?:clausura|apertura) liga profesional de argentina \d{4} fase regular$/.test(normalized(article.title))) return false;
  // Acuité's shop-sale classifieds are offers, not news reports. Keep its
  // reporting about businesses and acquisitions; the ad's date is not disputed.
  if (normalized(article.sourceName ?? "") === "acuite" &&
      /^a ceder fonds de commerce d optique lunetterie\b/.test(normalized(article.title))) return false;
  // OEC's commodity/country profiles are reusable trade databases, not dated
  // news. A recent RSS crawl cannot establish original publication. Match the
  // profile template only, retaining reporting that cites OEC statistics.
  if (/\b(?:en el comercio de|in the trade of)\b.*\b(?:observatorio de complejidad economica|observatory of economic complexity)\b/.test(normalized(article.title))) return false;
  // Verified Guatemala.com event listings, laprensa.hn archive stories and
  // Economy.com.bo articles received new RSS crawl dates despite original
  // publication years earlier. Economy's publisher pages date the 2022
  // reputation ranking to July 2023 and its anniversaries to May 2025/2026; the Economy RSS alias also recrawls September 2026 reports.
  // The RSS does not distinguish those crawl timestamps from original dates,
  // even for undated titles. Quarantine these sources until original publication
  // dates can be verified; do not guess dates or pad feeds with old material.
  if (["guatemala com", "www laprensa hn", "laprensa hn", "economy com bo", "www economy com bo", "economy", "economy bolivia"].includes(normalized(article.sourceName ?? ""))) return false;
  // DIMAR's February Antarctic report and October 23 maritime agreement both
  // arrived with an October 30 RSS crawl date. Quarantine these exact publisher
  // identities until original dates can be verified; not every report is old.
  if (["portal maritimo colombiano dimar", "portal maritimo colombiano", "dimar", "dimar mil co", "www dimar mil co"].includes(normalized(article.sourceName ?? ""))) return false;
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
  // A syndicator can retain a second publisher's trailing credit after RSS
  // normalization. That name must not supply the story's category evidence.
  let title = article.title.replace(/\s+[|–—-]\s+El Comercio\s*$/iu, "");
  if (feed.key === "culture") {
    title = normalized(title).replace(figurativeCulture, " ").replace(financialOrPreventiveCulture, " ").replace(booksAsPolicyMetaphor, " ").replace(/\barte de pensar\b/g, " ");
    // School administration/infrastructure is not literary coverage just
    // because schoolbooks are mentioned; retain independent arts evidence.
    if (schoolContext.test(title) && !terms.filter(term => !genericBooks.has(term)).some(term => matches(title, term))) return false;
    const sports = languages.flatMap(language => [...topics[language].sports.split("|"), ...(topicMatchTerms[`${language}/sports`] ?? "").split("|")]);
    // A sporting "festival" is not an arts festival. Preserve actual music,
    // cinema, heritage, etc. even when a title also discusses sport.
    if (([...sports, ...sportingEventTerms].some(term => matches(title, term)) || /\b(?:sub|under|u) \d{1,2}\b/.test(title) || scienceFestival.test(title) || wildlifeFestival.test(title) || hobbyFestival.test(title)) &&
        !terms.filter(term => term !== "festival").some(term => matches(title, term))) return false;
  }
  if (feed.key === "business") title = normalized(title).replace(diplomaticBusinessTitles, " ");
  if (feed.key === "crime") {
    // The football club's name is not a justice-system reference. Preserve
    // independent reports about actual crimes involving the club.
    title = normalized(title).replace(noncriminalJustice, " ").replace(/\bdefensa y justicia\b/g, " ");
    if (civilDispute.test(title) && !terms.filter(term => !civilJusticeTerms.has(term)).some(term => matches(title, term))) return false;
    const sports = languages.flatMap(language => [...topics[language].sports.split("|"), ...(topicMatchTerms[`${language}/sports`] ?? "").split("|")]);
    if ((policeCommunityEvents.test(title) || sports.some(term => matches(title, term))) &&
        !terms.filter(term => !weakCrimeTerms.has(term)).some(term => matches(title, term))) return false;
  }
  if (feed.key === "politics") {
    title = normalized(title).replace(/\b\d{1,2}(?: \d{2})? pm\b/g, " ");
    // Academic/industry congresses are conferences, not legislatures. An
    // independent government, election or policy reference can still qualify.
    title = title.replace(/\b(?:congreso|congresso) (?:internacional|latinoamericano|cientifico|academico|medico)\b|\b(?:international|academic|medical|scientific) congress\b/g, " ");
  }
  if (feed.key === "world") {
    title = normalized(title).replace(honoraryAmbassadors, " ").replace(internationalAirport, " ").replace(/\bcentro bancario internacional\b/g, " ").replace(/\b(?:camino|ruta|avenida|carretera) internacional\b/g, " ");
    // Unimed Mercosul is a regional Brazilian medical-cooperative federation,
    // not the international bloc; its domestic cooperation needs another partner.
    const domestic = domesticCooperation.test(title) || /\bunimed mercosul\b/.test(title) || matches(title, `por ${profiles[country.id][1]}`);
    if (domestic && !terms.filter(term => !cooperationTerms.has(term)).some(term => matches(title, term))) {
      const otherCountries = Object.entries(profiles).filter(([id]) => id !== country.id)
        .flatMap(([id, profile]) => [...profile[2].split("|"), ...translatedCountries[id]]);
      if (![...otherCountries, ...externalPartners].some(term => matches(title, term))) return false;
    }
    // "International" describes products, services and events too. Require
    // independently meaningful affairs context instead of an endless list of
    // unrelated labels; the existing sport/arts boundaries still apply below.
    const affairsContext = /\b(?:acuerdos?|alianzas?|tratados?|conflictos?|crisis|sanciones|mediacion|comunidad|politica|observadores|prensa|imprensa|acordos?|aliancas?|conflitos?|presse|traites?|accords?) (?:internacional\w*|international\w*)\b|\binternational (?:treaty|treaties|agreement|alliance|conflict|crisis|sanctions|mediation|community|politics|observers|press)\b|\b(?:amnistia internacional|amnesty international|corte internacional de justicia|international criminal court|mision academica internacional)\b|\b(?:relacoes|relaciones|relations|betrekkingen) (?:entre|between|tussen)\b/;
    // Primary review established this exact commentary as international
    // scientific cooperation and peace, despite its ambiguous headline.
    const reviewedCooperation = normalized(article.sourceName ?? "") === "pressenza" &&
      normalized(article.title) === "un gran triunfo internacional en los cielos chilenos";
    if (!terms.filter(term => !weakWorldTerms.has(term)).some(term => matches(title, term)) &&
        !affairsContext.test(title) && !reviewedCooperation) return false;
    const sports = languages.flatMap(language => [...topics[language].sports.split("|"), ...(topicMatchTerms[`${language}/sports`] ?? "").split("|")]);
    // Foreign press can cover a domestic football dispute without naming the
    // sport. These reviewed player/coach references still need affairs evidence.
    const reviewedFootball = /\bhernan barcos\b/.test(title) && /\bpablo guede\b/.test(title);
    if ((reviewedFootball || [...sports, ...sportingEventTerms, "ciclist*", "cycling", "wieler*", ...entertainmentTerms, ...nonWorldEvents].some(term => matches(title, term))) &&
        !terms.filter(term => !weakWorldTerms.has(term)).some(term => matches(title, term))) return false;
  }
  if (feed.key === "sports" && /\bseleccion (?:de )?(?:jueces|magistrados|candidatos|personal)\b/.test(normalized(title))) return false;
  return terms.some(term => matches(title, term));
}
