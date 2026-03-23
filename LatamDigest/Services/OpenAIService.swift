import Foundation

/// A helper service that wraps calls to the OpenAI API to summarise and
/// cluster news headlines.  This class uses the `Responses` endpoint
/// introduced in 2025 which supports web search, structured outputs and
/// JSON schemas.  You should not call this service directly from the
/// iOS client in production; instead, your backend should perform these
/// calls on a schedule and cache the results.
final class OpenAIService {
    static let shared = OpenAIService()
    private init() {}

    enum ConfigurationError: LocalizedError {
        case missingAPIKey

        var errorDescription: String? {
            switch self {
            case .missingAPIKey:
                return "OPENAI_API_KEY is missing. Configure it in the app environment or move this call to your backend."
            }
        }
    }

    private let baseURL = URL(string: "https://api.openai.com/v1/responses")!

    /// Shared URLSession configured with appropriate timeouts.
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        return URLSession(configuration: config)
    }()

    /// Fetches a summarised daily digest for the given country.  The
    /// function constructs a prompt asking the model to research the
    /// most important stories for the country using its built‑in web
    /// search, summarise them and return structured JSON.  On success
    /// it returns the raw JSON string.  Errors are propagated.
    func fetchDailyDigest(for countryCode: String) async throws -> String {
        guard let apiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"], !apiKey.isEmpty else {
            throw ConfigurationError.missingAPIKey
        }

        // Define the JSON schema we expect back from the model.  We
        // request a top level object with a daily_summary and an array
        // of stories.  Each story contains required fields.  For
        // details see OpenAI's structured output docs.
        let schema: [String: Any] = [
            "type": "object",
            "properties": [
                "country_code": ["type": "string"],
                "generated_at": ["type": "string"],
                "daily_summary": ["type": "string"],
                "stories": [
                    "type": "array",
                    "items": [
                        "type": "object",
                        "properties": [
                            "headline": ["type": "string"],
                            "source_name": ["type": "string"],
                            "source_url": ["type": "string"],
                            "category": ["type": "string"],
                            "summary": ["type": "string"],
                            "tldr": ["type": "string"],
                            "why_it_matters": ["type": "string"]
                        ],
                        "required": ["headline", "source_name", "source_url", "summary"]
                    ]
                ]
            ],
            "required": ["country_code", "generated_at", "daily_summary", "stories"]
        ]

        let requestDict: [String: Any] = [
            "model": "gpt-5-mini",
            "max_output_tokens": 1500,
            "tools": [
                ["type": "web_search_preview"]
            ],
            "text": [
                [
                    "format": [
                        "type": "json_schema",
                        "name": "latam_digest",
                        "schema": schema
                    ]
                ]
            ],
            "input": [
                [
                    "role": "system",
                    "content": [
                        [
                            "type": "input_text",
                            "text": "You prepare concise daily country news digests for a mobile app."
                        ]
                    ]
                ],
                [
                    "role": "user",
                    "content": [
                        [
                            "type": "input_text",
                            "text": "Gather the most important news stories for country code \(countryCode) from the past 24 hours. Deduplicate similar articles. For each story, provide the headline, source name, URL, category, summary, TLDR and why it matters. Also provide a daily summary for the country. Return valid JSON that matches the provided schema."
                        ]
                    ]
                ]
            ]
        ]
        let bodyData = try JSONSerialization.data(withJSONObject: requestDict, options: [])
        var request = URLRequest(url: baseURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = bodyData
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return String(data: data, encoding: .utf8) ?? ""
    }
}
