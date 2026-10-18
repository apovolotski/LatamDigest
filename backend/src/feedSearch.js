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
  CR: ["es", "Costa Rica", "Costa Rica|costarricense*"],
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
  PR: ["es", "Puerto Rico", "Puerto Rico|puertorriqueñ*"],
  SV: ["es", "El Salvador", "El Salvador|salvadoreñ*|salvadoran*"],
  UY: ["es", "Uruguay", "urugua*"],
  VE: ["es", "Venezuela", "venez*"],
  TT: ["en", "Trinidad and Tobago", "Trinidad|Tobago|Trinbagonian*|T&T|TTOC|Port of Spain"],
  SR: ["nl", "Suriname", "surinam*|Paramaribo"],
  GY: ["en", "Guyana", "Guyana|Guyanese"],
  GF: ["fr", "Guyane", "Guyane|guyanais*|guyanaise*|Cayenne|Kourou|Macouria|Matoury|Saint Laurent du Maroni"]
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
    world: "international|diplomatie|affaires étrangères|coopération|Brésil|Suriname"
  },
  nl: {
    politics: "politiek|regering|parlement|verkiezingen|president|assemblee",
    business: "bedrijven|handel|investeringen|industrie|ondernemers|zaken",
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

const extraStems = {
  es: "polític*|eleccio*|deport*|tecnol*|económ*|empresar*|cultur*|delincuen*",
  pt: "polític*|eleiç*|esport*|tecnol*|econôm*|empresar*|cultur*",
  fr: "", nl: "", en: ""
};

function normalized(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}*]+/gu, " ").trim();
}
function matches(text, term) {
  const value = ` ${normalized(text)} `;
  const word = normalized(term);
  if (word.endsWith("*")) return value.includes(` ${word.slice(0, -1)}`);
  return [word, `${word}s`, ...(word.endsWith("s") ? [word.slice(0, -1)] : [])]
    .some(form => value.includes(` ${form} `));
}
const quoted = value => `"${value}"`;

export function searchPlans(country, feed) {
  const profile = profiles[country.id];
  if (!profile) throw new Error(`No search profile for country ${country.id}`);
  const [language, name] = profile;
  const headline = ["top", "latest"].includes(feed.key);
  const days = headline ? [3, 7] : [7, 14];
  const countryQuery = country.id === "TT" ? '("Trinidad" OR "Tobago")' : quoted(name);
  const plans = days.map(lookbackDays => ({ language, lookbackDays, countryQuery }));
  if (language !== "en") plans.push({ language: "en", lookbackDays: days[1], countryQuery: quoted(country.name) });
  return plans.map(plan => ({ ...plan,
    query: `${plan.countryQuery}${headline ? "" : ` (${(queryTopics[`${plan.language}/${feed.key}`] ?? topics[plan.language][feed.key]).split("|").slice(0, 6).map(quoted).join(" OR ")})`} when:${plan.lookbackDays}d`,
    locale: localeFor(country.id, plan.language)
  }));
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
  const [localLanguage, , aliases] = profiles[country.id];
  // Cayenne is also a Porsche model; it alone is not geographic evidence.
  if (country.id === "GF" && /\b(porsche|taycan)\b/i.test(article.title) &&
      !["Guyane", "guyanais*", "guyanaise*", "Kourou"].some(term => matches(article.title, term))) return false;
  const countryTerms = `${aliases}|${country.name}`.split("|");
  if (!countryTerms.some(term => matches(article.title, term))) return false;
  if (["top", "latest"].includes(feed.key)) return true;
  if (feed.key === "tech" && /world wide technology championship/i.test(article.title)) return false;
  if (feed.key === "world" && /\b(football|soccer|cricket|basketball|pageant|world cup)\b/i.test(article.title) &&
      !/\b(foreign|diploma\w*|bilateral|minister|ambassador|cooperation|united nations|high commissioner|caricom)\b/i.test(article.title)) return false;
  const terms = [...new Set([localLanguage, "en"])].flatMap(language => topics[language][feed.key].split("|"));
  // Inflected adjectives are common in Romance-language headlines.
  const stems = (extraStems[localLanguage] || "").split("|").filter(Boolean)
    .filter(stem => terms.some(term => normalized(term).startsWith(normalized(stem).slice(0, -1))));
  return [...terms, ...stems].some(term => matches(article.title, term));
}
