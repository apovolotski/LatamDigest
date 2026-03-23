export const digestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    country_code: { type: "string" },
    country_name: { type: "string" },
    generated_at: { type: "string" },
    daily_summary: { type: "string" },
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          headline: { type: "string" },
          source_name: { type: "string" },
          source_url: { type: "string" },
          category: { type: "string" },
          summary: { type: "string" },
          why_it_matters: { type: "string" }
        },
        required: [
          "headline",
          "source_name",
          "source_url",
          "category",
          "summary",
          "why_it_matters"
        ]
      }
    }
  },
  required: [
    "country_code",
    "country_name",
    "generated_at",
    "daily_summary",
    "stories"
  ]
};
