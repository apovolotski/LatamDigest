import Foundation

enum WatchTopic: String, CaseIterable, Codable, Identifiable {
    case politics
    case economy
    case business
    case publicSafety
    case technology
    case culture
    case sports
    case health
    case energy
    case labor

    var id: String { rawValue }

    var localizationKey: String {
        switch self {
        case .politics: return "watch_topic_politics"
        case .economy: return "watch_topic_economy"
        case .business: return "watch_topic_business"
        case .publicSafety: return "watch_topic_public_safety"
        case .technology: return "watch_topic_technology"
        case .culture: return "watch_topic_culture"
        case .sports: return "watch_topic_sports"
        case .health: return "watch_topic_health"
        case .energy: return "watch_topic_energy"
        case .labor: return "watch_topic_labor"
        }
    }

    var subtitleKey: String {
        switch self {
        case .politics: return "watch_topic_politics_subtitle"
        case .economy: return "watch_topic_economy_subtitle"
        case .business: return "watch_topic_business_subtitle"
        case .publicSafety: return "watch_topic_public_safety_subtitle"
        case .technology: return "watch_topic_technology_subtitle"
        case .culture: return "watch_topic_culture_subtitle"
        case .sports: return "watch_topic_sports_subtitle"
        case .health: return "watch_topic_health_subtitle"
        case .energy: return "watch_topic_energy_subtitle"
        case .labor: return "watch_topic_labor_subtitle"
        }
    }

    var questionKey: String {
        switch self {
        case .politics: return "watch_topic_politics_question"
        case .economy: return "watch_topic_economy_question"
        case .business: return "watch_topic_business_question"
        case .publicSafety: return "watch_topic_public_safety_question"
        case .technology: return "watch_topic_technology_question"
        case .culture: return "watch_topic_culture_question"
        case .sports: return "watch_topic_sports_question"
        case .health: return "watch_topic_health_question"
        case .energy: return "watch_topic_energy_question"
        case .labor: return "watch_topic_labor_question"
        }
    }

    var icon: String {
        switch self {
        case .politics: return "building.columns"
        case .economy: return "chart.line.uptrend.xyaxis"
        case .business: return "briefcase"
        case .publicSafety: return "shield.lefthalf.filled"
        case .technology: return "cpu"
        case .culture: return "theatermasks"
        case .sports: return "sportscourt"
        case .health: return "cross.case"
        case .energy: return "bolt"
        case .labor: return "person.2"
        }
    }

    var keywords: [String] {
        #if JAPAN_EDITION
        return japaneseKeywords
        #else
        switch self {
        case .politics:
            return ["election", "elección", "elecciones", "president", "presidente", "senate", "senado", "congress", "congreso", "diputados", "oposición", "oficialismo", "parliament", "golpe"]
        case .economy:
            return ["econom", "inflation", "inflación", "mercado", "market", "deuda", "debt", "gdp", "pib", "tariff", "trade", "export", "import"]
        case .business:
            return ["business", "company", "empresa", "empresas", "startup", "industry", "industria", "retail", "bank", "banco"]
        case .publicSafety:
            return ["crime", "crimen", "seguridad", "security", "violence", "violencia", "police", "polic", "racismo", "racism", "defensa", "submarino", "narc", "homicid"]
        case .technology:
            return ["technology", "tecnología", "software", "digital", "ai", "ia", "inteligencia artificial", "startup", "chip", "cloud"]
        case .culture:
            return ["culture", "cultura", "art", "arte", "cine", "music", "música", "festival", "museum", "museo"]
        case .sports:
            return ["sport", "sports", "deporte", "deportes", "copa", "mundial", "selección", "seleccion", "partido", "vs", "goal", "gol", "liga", "fifa", "olympic"]
        case .health:
            return ["health", "salud", "hospital", "virus", "vaccine", "vacuna", "epidemi", "dengue", "covid", "sanitario"]
        case .energy:
            return ["energy", "energía", "oil", "gas", "renewable", "renovable", "electric", "hidro", "solar", "mining", "minería", "lithium", "litio"]
        case .labor:
            return ["labor", "labour", "laboral", "trabajo", "empleo", "employment", "salary", "salario", "union", "sindicato", "workers", "trabajadores"]
        }
        #endif
    }

    #if JAPAN_EDITION
    var japaneseKeywords: [String] {
        switch self {
        case .politics: return ["政治", "選挙", "国会", "首相", "内閣", "衆院", "参院", "自民", "政党", "外交", "大統領"]
        case .economy: return ["経済", "物価", "金利", "日銀", "為替", "円安", "円高", "景気", "インフレ", "gdp", "財政", "関税", "貿易"]
        case .business: return ["企業", "会社", "業績", "決算", "投資", "株式", "市場", "買収", "銀行", "メーカー", "小売", "経営"]
        case .publicSafety: return ["事件", "逮捕", "警察", "裁判", "犯罪", "事故", "地震", "台風", "災害", "避難", "大雨", "防災"]
        case .technology: return ["技術", "半導体", "人工知能", "ai", "デジタル", "ソフト", "通信", "ロボット", "宇宙", "サイバー", "データ"]
        case .culture: return ["文化", "映画", "音楽", "美術", "芸術", "アニメ", "出版", "書籍", "博物館", "文学"]
        case .sports: return ["スポーツ", "野球", "サッカー", "大相撲", "五輪", "オリンピック", "優勝", "選手", "大会", "リーグ", "試合"]
        case .health: return ["医療", "健康", "感染", "病院", "ワクチン", "ウイルス", "保険", "がん", "介護"]
        case .energy: return ["エネルギー", "電力", "原発", "石油", "ガス", "再生可能", "太陽光", "蓄電", "水素", "資源"]
        case .labor: return ["労働", "賃金", "雇用", "働き", "採用", "労組", "ストライキ", "人手不足", "給与", "春闘"]
        }
    }
    #endif

    static let defaultTopics: [WatchTopic] = [.politics, .economy, .publicSafety]
}
