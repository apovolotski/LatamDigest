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
    }

    static let defaultTopics: [WatchTopic] = [.politics, .economy, .publicSafety]
}
