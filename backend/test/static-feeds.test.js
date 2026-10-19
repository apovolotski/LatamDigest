import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { FeedRequestError, feedFailureLabel, fetchRSS } from "../src/rssClient.js";
import { fetchArticlesForFeed, generateFeeds } from "../scripts/generate-static-feeds.mjs";

const country = { id: "MX", name: "Mexico" };
const top = { key: "top", label: "Top", query: () => "Mexico when:3d" };
const latest = { ...top, key: "latest", label: "Latest" };
const article = { title: "News", url: "https://example.com/story", publishedAt: new Date(Date.now() - 3600_000).toISOString() };
const xml = `<rss version="2.0"><channel><item><title>News - Example</title><link>${article.url}</link><source>Example</source><pubDate>${article.publishedAt}</pubDate></item></channel></rss>`;
const noWait = { sleep: async () => {}, random: () => 0 };

test("RSS retries HTTP 503 and 429, honors Retry-After, then maps real XML", async () => {
  let calls = 0;
  const sleeps = [];
  const articles = await fetchArticlesForFeed(country, top, {
    ...noWait,
    sleep: async ms => sleeps.push(ms),
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return new Response("private body", { status: 503 });
      if (calls === 2) return new Response("private body", { status: 429, headers: { "retry-after": "3" } });
      return new Response(xml);
    }
  });
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [1000, 3000]);
  assert.equal(articles[0].title, article.title);
  assert.equal(articles[0].sourceName, "Example");
  assert.equal(articles[0].url, article.url);
});

test("RSS does not retry permanent HTTP errors or violate a long Retry-After", async () => {
  for (const [status, headers] of [[403, {}], [429, { "retry-after": "120" }]]) {
    let calls = 0;
    await assert.rejects(fetchRSS("https://example.com", {
      ...noWait,
      fetchImpl: async () => { calls++; return new Response("secret", { status, headers }); }
    }), error => error.status === status && error.attempts === 1);
    assert.equal(calls, 1);
  }
});

test("RSS accepts Retry-After HTTP dates", async () => {
  const retryAt = new Date(Date.now() + 30_000).toUTCString();
  const sleeps = [];
  let calls = 0;
  await fetchRSS("https://example.com", {
    ...noWait, sleep: async ms => sleeps.push(ms),
    fetchImpl: async () => ++calls === 1
      ? new Response("", { status: 503, headers: { "retry-after": retryAt } })
      : new Response(xml)
  });
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] > 25_000 && sleeps[0] <= 30_000);
});

test("network retries are bounded and diagnostics omit raw exception secrets", async () => {
  let calls = 0;
  await assert.rejects(fetchRSS("https://example.com", {
    ...noWait,
    fetchImpl: async () => { calls++; throw Error("provider-secret https://user:password@example.com"); }
  }), error => {
    assert.equal(feedFailureLabel(error), "network; attempts=3");
    assert.equal(error.message, "RSS network");
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(calls, 3);
});

test("HTML, malformed XML, oversized content and non-RSS XML are retried as invalid RSS", async () => {
  for (const body of ["<!DOCTYPE html><html/>", "<html/>", "<rss><channel>", "x".repeat(2_000_001)]) {
    let calls = 0;
    await assert.rejects(fetchRSS("https://example.com", {
      ...noWait, fetchImpl: async () => { calls++; return new Response(body); }
    }), error => error.code === "invalid-rss" && error.attempts === 3);
    assert.equal(calls, 3);
  }
});

test("valid empty RSS is not an upstream failure and is not retried", async () => {
  let calls = 0;
  assert.deepEqual(await fetchArticlesForFeed(country, top, {
    ...noWait, fetchImpl: async () => { calls++; return new Response("<rss><channel/></rss>"); }
  }), []);
  assert.equal(calls, 1);
});

test("request deadline covers a stalled HTTP body and retries stop after three attempts", async () => {
  const server = createServer((request, response) => { response.writeHead(200); response.flushHeaders(); });
  server.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    await assert.rejects(fetchRSS(`http://127.0.0.1:${server.address().port}`, {
      ...noWait, timeoutMs: 20
    }), error => error.code === "timeout" && error.attempts === 3);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("refresh cancellation stops retry backoff immediately", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fetchRSS("https://example.com", {
    signal: controller.signal,
    fetchImpl: async () => { calls++; return new Response("", { status: 503 }); },
    sleep: async (ms, value, options) => { controller.abort(); options.signal.throwIfAborted(); }
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});

async function fixture(t) {
  const destination = await mkdtemp(path.join(tmpdir(), "latam-rss-"));
  t.after(() => rm(destination, { recursive: true, force: true }));
  const options = { countries: [country], feeds: [top, latest], destination };
  await generateFeeds({ ...options, fetchFeed: async () => [article] });
  const files = ["manifest.json", "countries.json", "countries/MX/top.json", "countries/MX/latest.json"];
  const snapshot = () => Promise.all(files.map(file => readFile(path.join(destination, file), "utf8")));
  return { destination, options, snapshot };
}

test("all-feed failure leaves every published byte and timestamp untouched", async t => {
  const { options, snapshot } = await fixture(t);
  const before = await snapshot();
  const result = await generateFeeds({ ...options, fetchFeed: async () => [] });
  assert.equal(result.succeeded, 0);
  assert.deepEqual(await snapshot(), before);
});

test("five consecutive upstream failures stop early without publishing even pending successes", async t => {
  const { options, snapshot } = await fixture(t);
  const before = await snapshot();
  let calls = 0;
  await assert.rejects(generateFeeds({
    ...options, feeds: Array.from({ length: 10 }, (_, i) => ({ ...top, key: `feed${i}` })),
    fetchFeed: async () => {
      if (++calls === 1) return [article];
      throw new FeedRequestError("http", { status: 503, retryable: true });
    }
  }), /5 consecutive feeds/);
  assert.equal(calls, 6);
  assert.deepEqual(await snapshot(), before);
  await assert.rejects(readFile(path.join(options.destination, "countries/MX/category/feed0.json")), { code: "ENOENT" });
});

test("partial refresh retains recent cache and timestamp, expires cache older than seven days", async t => {
  const { destination, options } = await fixture(t);
  const manifestPath = path.join(destination, "manifest.json");
  const first = JSON.parse(await readFile(manifestPath));
  const fetchFeed = async (country, feed) => feed.key === "top" ? [] : [article];
  await generateFeeds({ ...options, fetchFeed });
  let manifest = JSON.parse(await readFile(manifestPath));
  assert.equal(manifest.countries[0].feeds.top.updatedAt, first.countries[0].feeds.top.updatedAt);
  assert.equal(manifest.countries[0].feeds.top.stale, true);
  assert.deepEqual(JSON.parse(await readFile(path.join(destination, "countries/MX/top.json"))), [article]);
  manifest.countries[0].feeds.top.updatedAt = new Date(Date.now() - 8 * 24 * 3600_000).toISOString();
  await writeFile(manifestPath, JSON.stringify(manifest));
  await generateFeeds({ ...options, fetchFeed });
  manifest = JSON.parse(await readFile(manifestPath));
  assert.equal(manifest.countries[0].feeds.top.updatedAt, null);
  assert.deepEqual(JSON.parse(await readFile(path.join(destination, "countries/MX/top.json"))), []);
});

test("expired overall refresh budget leaves the prior publication untouched", async t => {
  const { options, snapshot } = await fixture(t);
  const before = await snapshot();
  const controller = new AbortController();
  await assert.rejects(generateFeeds({ ...options, signal: controller.signal, fetchFeed: async () => {
    controller.abort();
    throw Error("secret");
  } }), /deadline exceeded/);
  assert.deepEqual(await snapshot(), before);
});
