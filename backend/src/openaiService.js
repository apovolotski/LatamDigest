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
  const windows = [
    {
      label: "past 24 hours",
      minimumStories: 4
    },
    {
      label: "past 72 hours",
      minimumStories: 4
    },
    {
      label: "past 7 days",
      minimumStories: 4
    }
  ];

  let lastDigest = null;

  for (const window of windows) {
    const result = await requestDigest({
      countryCode,
      countryName,
      timeWindow: window.label
    });

    lastDigest = result;
    if (result.stories.length >= window.minimumStories) {
      return result;
    }
  }

  if (lastDigest) {
    return lastDigest;
  }

  throw new Error(`Unable to generate a digest for ${countryCode}.`);
}

async function requestDigest({ countryCode, countryName, timeWindow }) {
  const response = await getClient().responses.create({
    model: config.openaiModel,
    input: `Create a high-quality AI-curated daily news digest for ${countryName} (${countryCode}) focused on the ${timeWindow}.

Requirements:
- Use web search to find credible recent reporting.
- Deduplicate overlapping stories.
- Include the most important political, economic, business, crime, sports, technology, culture, international, and society stories if relevant.
- Prefer primary reporting and major reputable outlets.
- Return between 4 and 10 stories.
- Each story must include the direct article URL from a reporting source, not a homepage.
- Each summary should be concise and useful in a mobile app.
- "why_it_matters" should explain relevance in one short paragraph.
- Do not ask follow-up questions.
- Do not refuse just because the exact past 24 hours is sparse; use the best important and still-recent stories within the requested window.
- Output only JSON matching the provided schema.`,
    instructions:
      "You are the editorial engine for a Latin America news app. Be decisive, accurate, and concise. Always return a usable digest. Do not ask clarifying questions. If coverage is thin, return the strongest still-recent verified stories in the requested window.",
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
