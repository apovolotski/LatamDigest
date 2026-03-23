import OpenAI from "openai";
import { partialParse } from "openai/_vendor/partial-json-parser/parser.js";
import { z } from "zod";
import { config } from "./config.js";

const storySchema = z.object({
  headline: z.string(),
  source_name: z.string(),
  source_url: z.string(),
  category: z.string(),
  summary: z.string(),
  why_it_matters: z.string()
});

const synthesisStorySchema = z.object({
  headline: z.string().optional(),
  title: z.string().optional(),
  source_name: z.string().optional(),
  source: z.string().optional(),
  source_url: z.string().optional(),
  url: z.string().optional(),
  category: z.string().optional(),
  summary: z.string().optional(),
  why_it_matters: z.string().optional()
});

const synthesisResponseSchema = z.object({
  daily_summary: z.string().optional(),
  stories: z.array(synthesisStorySchema)
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
  const searchResponse = await getClient().responses.create({
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
  });

  const response = await createSynthesisResponse({
    previousResponseId: searchResponse.id,
    countryCode,
    countryName,
    timeWindow
  });

  let parsed;
  try {
    parsed = normalizeDigestPayload(
      synthesisResponseSchema.parse(parseStructuredResponse(response)),
      { countryCode, countryName }
    );
  } catch (error) {
    const retryResponse = await createSynthesisResponse({
      previousResponseId: searchResponse.id,
      countryCode,
      countryName,
      timeWindow,
      compact: true
    });

    parsed = normalizeDigestPayload(
      synthesisResponseSchema.parse(parseStructuredResponse(retryResponse)),
      { countryCode, countryName }
    );

    return {
      ...parsed,
      request_id: retryResponse._request_id,
      sources: dedupeSources([
        ...extractSources(searchResponse),
        ...extractSources(retryResponse)
      ])
    };
  }

  return {
    ...parsed,
    request_id: response._request_id,
    sources: dedupeSources([
      ...extractSources(searchResponse),
      ...extractSources(response)
    ])
  };
}

async function createSynthesisResponse({
  previousResponseId,
  countryCode,
  countryName,
  timeWindow,
  compact = false
}) {
  return getClient().responses.create({
    model: config.openaiModel,
    previous_response_id: previousResponseId,
    input: compact
      ? `Using the search results you already gathered for ${countryName} (${countryCode}), produce compact final JSON for the ${timeWindow}.

Requirements:
- Output only valid JSON.
- Return exactly 5 stories.
- Keep each summary to 1 sentence.
- Keep each why_it_matters field to 1 short sentence.
- Use only stories supported by the gathered search results.
- Prefer direct reporting URLs, not homepages or PDFs.
- Do not ask follow-up questions.
- Use this exact JSON shape:
{"daily_summary":"...","stories":[{"title":"...","source":"...","url":"...","category":"...","summary":"...","why_it_matters":"..."}]}`
      : `Using the search results you already gathered for ${countryName} (${countryCode}), produce the final mobile-news digest JSON for the ${timeWindow}.

Requirements:
- Output only valid JSON.
- Return between 4 and 10 stories when possible.
- Use only stories supported by the gathered search results.
- Prefer direct reporting URLs, not homepages or PDFs.
- Do not ask follow-up questions.
- If the strict ${timeWindow} window is sparse, still return the strongest recent stories you found.
- Use this exact JSON shape:
{"daily_summary":"...","stories":[{"title":"...","source":"...","url":"...","category":"...","summary":"...","why_it_matters":"..."}]}`,
    max_output_tokens: compact ? 2200 : 3200
  });
}

function normalizeDigestPayload(payload, { countryCode, countryName }) {
  const stories = payload.stories
    .map((story) => ({
      headline: story.headline || story.title || "",
      source_name: story.source_name || story.source || "",
      source_url: story.source_url || story.url || "",
      category: story.category || "top",
      summary: story.summary || "",
      why_it_matters: story.why_it_matters || ""
    }))
    .filter(
      (story) =>
        story.headline &&
        story.source_name &&
        story.source_url &&
        story.summary &&
        story.why_it_matters
    );

  return digestResponseSchema.parse({
    country_code: countryCode,
    country_name: countryName,
    generated_at: new Date().toISOString(),
    daily_summary:
      payload.daily_summary ||
      `Top recent developments for ${countryName}, curated from reporting sources across politics, business, society, and culture.`,
    stories
  });
}

function parseStructuredResponse(response) {
  const candidateTexts = [
    response.output_text,
    ...extractOutputTexts(response)
  ]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const candidate of candidateTexts) {
    const parsed = tryParseJSON(candidate);
    if (parsed) {
      return parsed;
    }

    const partial = tryPartialParseJSON(candidate);
    if (partial) {
      return partial;
    }

    const extracted = extractJSONObject(candidate);
    if (extracted) {
      const reparsed = tryParseJSON(extracted);
      if (reparsed) {
        return reparsed;
      }
    }
  }

  throw new Error(
    `OpenAI returned no parseable JSON. Request ID: ${response._request_id || "unknown"}`
  );
}

function extractOutputTexts(response) {
  const texts = [];

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.parsed) {
        texts.push(JSON.stringify(content.parsed));
      }

      if (typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }

  return texts;
}

function tryParseJSON(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function tryPartialParseJSON(value) {
  try {
    return partialParse(value);
  } catch {
    return null;
  }
}

function extractJSONObject(value) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1);
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
