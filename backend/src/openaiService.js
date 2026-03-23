import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config.js";
import { digestSchema } from "./schema.js";

const storySchema = z.object({
  headline: z.string(),
  source_name: z.string(),
  source_url: z.string().url(),
  category: z.string(),
  summary: z.string(),
  why_it_matters: z.string()
});

const digestResponseSchema = z.object({
  country_code: z.string(),
  country_name: z.string(),
  generated_at: z.string(),
  daily_summary: z.string(),
  stories: z.array(storySchema)
});

let client;

function getClient() {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the backend.");
  }

  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  return client;
}

export async function generateDigest({ countryCode, countryName }) {
  const response = await getClient().responses.create({
    model: config.openaiModel,
    input: `Create a high-quality AI-curated daily news digest for ${countryName} (${countryCode}) focused on the last 24 hours. 

Requirements:
- Use web search to find credible recent reporting.
- Deduplicate overlapping stories.
- Include the most important political, economic, business, crime, sports, technology, culture, international, and society stories if relevant.
- Prefer primary reporting and major reputable outlets.
- Return 6 to 10 stories.
- Each summary should be concise and useful in a mobile app.
- "why_it_matters" should explain relevance in one short paragraph.
- Use the article URL from the reporting source, not a homepage.
- Output only data that matches the required JSON schema.`,
    instructions:
      "You are the editorial engine for a Latin America news app. Focus on accuracy, recency, and concise synthesis. Avoid sensationalism. If evidence is weak, omit the story instead of guessing.",
    tools: [{ type: "web_search" }],
    include: ["web_search_call.action.sources"],
    max_tool_calls: 8,
    max_output_tokens: 2200,
    text: {
      format: {
        type: "json_schema",
        name: "latam_digest",
        strict: true,
        schema: digestSchema
      }
    }
  });

  const parsed = digestResponseSchema.parse(JSON.parse(response.output_text));

  return {
    ...parsed,
    request_id: response._request_id,
    sources: extractSources(response)
  };
}

function extractSources(response) {
  const sources = [];

  for (const item of response.output || []) {
    if (item.type !== "web_search_call" || !item.action?.sources) {
      continue;
    }

    for (const source of item.action.sources) {
      sources.push({
        title: source.title || null,
        url: source.url || null
      });
    }
  }

  return dedupeSources(sources);
}

function dedupeSources(sources) {
  const seen = new Set();

  return sources.filter((source) => {
    const key = `${source.title || ""}|${source.url || ""}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
