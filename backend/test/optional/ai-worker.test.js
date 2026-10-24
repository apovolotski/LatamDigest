import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { generateDigest } from "../../src/openaiService.js";

const country = { countryCode: "MX", countryName: "Mexico" };
const story = index => ({
  title: `Mexico headline ${index}`,
  source: "Example News",
  url: `https://example.com/news/${index}`,
  category: "politics",
  summary: "A reported development.",
  why_it_matters: "Its local significance."
});
const payload = count => ({ stories: Array.from({ length: count }, (_, i) => story(i)) });
const search = { id: "search", output: [{ type: "web_search_call", action: {
  sources: [{ title: "Example News", url: "https://example.com/news" }]
} }] };
const synthesis = value => ({ id: "synthesis", output: [{ type: "message", content: [
  { type: "output_text", text: typeof value === "string" ? value : JSON.stringify(value) }
] }] });

// Exercise the actual SDK request/response path without credentials or paid calls.
function provider(responses) {
  const calls = [];
  const client = new OpenAI({
    apiKey: "test-fixture-only",
    maxRetries: 0,
    fetch: async (url, options) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      calls.push(JSON.parse(options.body));
      assert(responses.length, "Unexpected provider request");
      return new Response(JSON.stringify(responses.shift()), {
        headers: { "content-type": "application/json", "x-request-id": "fixture-request" }
      });
    }
  });
  return { client, calls };
}

test("upgraded SDK and validator preserve search, synthesis, normalization and sources", async () => {
  const { client, calls } = provider([search, synthesis(payload(4))]);
  const digest = await generateDigest(country, { client });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].tools[0].type, "web_search");
  assert.equal(calls[1].previous_response_id, "search");
  assert.equal(digest.country_code, "MX");
  assert.equal(digest.stories.length, 4);
  assert.equal(digest.stories[0].headline, story(0).title);
  assert.equal(digest.stories[0].source_url, story(0).url);
  assert.equal(digest.request_id, "fixture-request");
  assert.deepEqual(digest.sources, search.output[0].action.sources);
});

test("incident 40026114377: oversized story arrays are rejected before compact retry", async () => {
  const { client, calls } = provider([search, synthesis(payload(5_000)), synthesis(payload(5))]);
  const digest = await generateDigest(country, { client });
  assert.equal(calls.length, 3);
  assert.match(calls[2].input, /produce compact final JSON/);
  assert.equal(calls[2].previous_response_id, "search");
  assert.equal(digest.stories.length, 5);
  // Repeated oversized responses fail; they are never silently sliced or accepted.
  const rejected = provider([search, synthesis(payload(11)), synthesis(payload(11))]);
  await assert.rejects(generateDigest(country, { client: rejected.client }), error =>
    error.issues.length === 1 && error.issues[0].code === "too_big" && error.issues[0].path[0] === "stories");
  assert.equal(rejected.calls.length, 3);
  const invalidItems = synthesis({ stories: Array(5_000).fill(null) });
  const oversizedInvalid = provider([search, invalidItems, invalidItems]);
  await assert.rejects(generateDigest(country, { client: oversizedInvalid.client }), error =>
    error.issues.length === 1 && error.issues[0].code === "too_big");
});

test("upgraded SDK retains truncated JSON recovery and optional story defaults", async () => {
  const value = payload(4);
  delete value.stories[0].category;
  const truncated = JSON.stringify(value).slice(0, -1);
  const { client, calls } = provider([search, synthesis(truncated)]);
  const digest = await generateDigest(country, { client });
  assert.equal(calls.length, 2);
  assert.equal(digest.stories.length, 4);
  assert.equal(digest.stories[0].category, "top");
});

test("upgraded validator rejects malformed story types and preserves bounded sparse retries", async () => {
  const malformed = payload(4);
  malformed.stories[0].title = 123;
  const retry = provider([search, synthesis(malformed), synthesis(payload(4))]);
  assert.equal((await generateDigest(country, { client: retry.client })).stories.length, 4);
  assert.equal(retry.calls.length, 3);
  const sparse = provider(Array.from({ length: 3 }, () => [search, synthesis(payload(2))]).flat());
  assert.equal((await generateDigest(country, { client: sparse.client })).stories.length, 2);
  assert.equal(sparse.calls.length, 6);
  for (const [index, window] of ["24 hours", "72 hours", "7 days"].entries()) {
    assert(sparse.calls[index * 2].input.includes(window));
  }
});
