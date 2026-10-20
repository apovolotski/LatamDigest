import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { refreshFeeds } from "../scripts/refresh-static-feeds.mjs";
import { generateFeeds, fetchArticlesForFeed } from "../scripts/generate-static-feeds.mjs";
import { checkCoverage } from "../scripts/check-feed-coverage.mjs";
import { FeedRequestError, UpstreamUnavailableError } from "../src/rssClient.js";
import { toArticle } from "../scripts/generate-static-feeds.mjs";

const country = { id: "NI", name: "Nicaragua" };
const title = "Nicaragua: economía, política, empresas, deportes, tecnología, cultura, crimen y diplomacia";
const article = () => toArticle({ title, link: "https://example.com/news", source: "Example",
  pubDate: new Date(Date.now() - 3600_000).toISOString() }, country, { label: "Top" });
const failure = (options = {}) => {
  const error = new FeedRequestError("http", { status: 503, retryable: true, ...options });
  error.attempts = 3;
  return new UpstreamUnavailableError(error);
};

async function fixture(t) {
  const folder = await mkdtemp(path.join(tmpdir(), "latam-recovery-"));
  const destination = path.join(folder, "api");
  t.after(() => rm(folder, { recursive: true, force: true }));
  await generateFeeds({ destination, countries: [country], fetchFeed: async () => [article()] });
  const snapshot = async () => {
    const files = (await readdir(destination, { recursive: true })).filter(file => file.endsWith(".json") && file !== "refresh-status.json").sort();
    return Promise.all(files.map(async file => [file, await readFile(path.join(destination, file), "utf8")]));
  };
  return { destination, countries: [country], snapshot, summaryFile: path.join(folder, "summary.md") };
}

async function assertRetained(f, before) {
  const after = await f.snapshot();
  assert.deepEqual(after.filter(([file]) => file !== "manifest.json"), before.filter(([file]) => file !== "manifest.json"));
  const original = JSON.parse(before.find(([file]) => file === "manifest.json")[1]);
  const current = JSON.parse(after.find(([file]) => file === "manifest.json")[1]);
  assert.equal(current.generatedAt, original.generatedAt);
  for (const [key, status] of Object.entries(current.countries[0].feeds)) {
    assert.equal(status.updatedAt, original.countries[0].feeds[key].updatedAt);
    assert.equal(status.stale, true);
  }
}

const unavailable = async () => { throw failure(); };
const instant = async () => {};

test("incident regression: thirty HTTP 503 responses preserve verified coverage and report degraded health", async t => {
  const f = await fixture(t), before = await f.snapshot();
  let requests = 0;
  const pauses = [];
  const status = await refreshFeeds({ ...f, sleep: async ms => pauses.push(ms),
    generate: options => generateFeeds({ ...options, fetchFeed: (country, feed, options) => fetchArticlesForFeed(country, feed, {
      ...options, sleep: instant, random: () => 0,
      fetchImpl: async () => { requests++; return new Response("private provider body", { status: 503 }); }
    }) })
  });
  assert.equal(requests, 30); // 3 attempts × 5 feeds × 2 full refresh attempts
  assert.deepEqual(pauses, [60_000]);
  assert.equal(status.state, "degraded");
  assert.equal(status.mode, "cached");
  assert.equal(status.refreshedFeeds, 0);
  assert.equal(status.cachedFeeds, 10);
  assert.deepEqual(status.failure, { code: "http", status: 503, attempts: 3 });
  await assertRetained(f, before);
  assert.equal((await checkCoverage(f)).issues.length, 0);
  const health = await readFile(path.join(f.destination, "refresh-status.json"), "utf8");
  assert.ok(!health.includes("private provider body"));
  assert.equal(JSON.parse(health).lastSuccessfulRefreshAt, JSON.parse(before.find(([file]) => file === "manifest.json")[1]).generatedAt);
  assert.match(await readFile(f.summaryFile, "utf8"), /Refreshed feeds: 0\/10/);
});

test("provider recovery after the cooldown publishes a healthy verified refresh", async t => {
  const f = await fixture(t);
  let attempts = 0, requests = 0;
  const status = await refreshFeeds({ ...f, sleep: instant, generate: options => {
    const outage = ++attempts === 1;
    return generateFeeds({ ...options, fetchFeed: (country, feed, options) => fetchArticlesForFeed(country, feed, {
      ...options, sleep: instant,
      fetchImpl: async () => {
        requests++;
        if (outage) return new Response("", { status: 503 });
        const a = article();
        return new Response(`<rss><channel>${[1, 2, 3].map(i => `<item><title>${a.title} ${i}</title><link>${a.url}?story=${i}</link><source>Example</source><pubDate>${a.publishedAt}</pubDate></item>`).join("")}</channel></rss>`);
      }
    }) });
  } });
  assert.equal(requests, 25);
  assert.equal(status.state, "healthy");
  assert.equal(status.attempts, 2);
  assert.equal(status.refreshedFeeds, 10);
  assert.equal((await checkCoverage(f)).issues.length, 0);
});

test("failed attempts cannot publish partially generated output", async t => {
  const f = await fixture(t), before = await f.snapshot();
  const status = await refreshFeeds({ ...f, sleep: instant, generate: async ({ destination }) => {
    await writeFile(path.join(destination, "countries/NI/top.json"), "[]");
    throw failure();
  } });
  assert.equal(status.mode, "cached");
  await assertRetained(f, before);
});

test("one feed older than 24 hours blocks recovery even if the manifest is newly dated", async t => {
  const f = await fixture(t);
  const file = path.join(f.destination, "manifest.json");
  const manifest = JSON.parse(await readFile(file));
  manifest.countries[0].feeds.top.updatedAt = new Date(Date.now() - 25 * 3600_000).toISOString();
  await writeFile(file, JSON.stringify(manifest));
  const before = await f.snapshot();
  await assert.rejects(refreshFeeds({ ...f, sleep: instant, generate: unavailable }), /24-hour recovery limit/);
  assert.deepEqual(await f.snapshot(), before);
  await assert.rejects(readFile(path.join(f.destination, "refresh-status.json")), { code: "ENOENT" });
});

test("missing, unsafe, unrelated or expired cached stories cannot turn an outage green", async t => {
  for (const variant of ["missing", "unsafe", "unrelated", "old"]) {
    const f = await fixture(t);
    const file = path.join(f.destination, "countries/NI/top.json");
    if (variant === "missing") await rm(file);
    else {
      const a = article();
      if (variant === "unsafe") a.url = "javascript:alert(1)";
      if (variant === "unrelated") a.title = "Argentina gana torneo";
      if (variant === "old") a.publishedAt = new Date(Date.now() - 15 * 86_400_000).toISOString();
      await writeFile(file, JSON.stringify([a]));
    }
    await assert.rejects(refreshFeeds({ ...f, sleep: instant, generate: unavailable }), /incomplete or invalid/);
    await assert.rejects(readFile(path.join(f.destination, "refresh-status.json")), { code: "ENOENT" });
  }
});

test("repeated cache checks never renew the original refresh timestamps", async t => {
  const f = await fixture(t), before = await f.snapshot(), start = Date.now();
  const first = await refreshFeeds({ ...f, sleep: instant, now: () => start + 23 * 3600_000, generate: unavailable });
  assert.equal(first.state, "degraded");
  await assert.rejects(refreshFeeds({ ...f, sleep: instant, now: () => start + 25 * 3600_000, generate: unavailable }), /24-hour recovery limit/);
  await assertRetained(f, before);
});

test("programming errors stay fatal and are not mistaken for provider outages", async t => {
  const f = await fixture(t), before = await f.snapshot();
  let calls = 0;
  await assert.rejects(refreshFeeds({ ...f, sleep: async () => assert.fail("must not retry"),
    generate: options => generateFeeds({ ...options, fetchFeed: async () => { calls++; throw Error("private unexpected detail"); } })
  }), error => error.message === "Unexpected feed error for NI/top; no files published.");
  assert.equal(calls, 1);
  assert.deepEqual(await f.snapshot(), before);
});

test("permanent HTTP errors are not hidden behind cache recovery", async t => {
  const f = await fixture(t);
  let attempts = 0;
  await assert.rejects(refreshFeeds({ ...f, sleep: instant, generate: async () => {
    attempts++;
    throw failure({ status: 403, retryable: false });
  } }), /HTTP 403/);
  assert.equal(attempts, 1);
});

test("cancellation during cooldown cannot publish or fall back", async t => {
  const f = await fixture(t), before = await f.snapshot();
  const controller = new AbortController();
  await assert.rejects(refreshFeeds({ ...f, signal: controller.signal, generate: unavailable,
    sleep: async (ms, value, { signal }) => { controller.abort(); signal.throwIfAborted(); }
  }), { name: "AbortError" });
  assert.deepEqual(await f.snapshot(), before);
  await assert.rejects(readFile(path.join(f.destination, "refresh-status.json")), { code: "ENOENT" });
});

test("a long Retry-After uses verified cache without retrying earlier than requested", async t => {
  const f = await fixture(t);
  let attempts = 0;
  const status = await refreshFeeds({ ...f, sleep: async () => assert.fail("must not wait past budget"),
    generate: async () => { attempts++; throw failure({ retryAfterMs: 3600_000 }); }
  });
  assert.equal(attempts, 1);
  assert.equal(status.attempts, 1);
  assert.equal(status.mode, "cached");
});

test("invalid newly generated output fails without replacing a valid publication", async t => {
  const f = await fixture(t), before = await f.snapshot();
  await assert.rejects(refreshFeeds({ ...f, sleep: instant, generate: async ({ destination }) => {
    await writeFile(path.join(destination, "countries/NI/top.json"), "[]");
    return { succeeded: 10, manifest: { generatedAt: new Date().toISOString() } };
  } }), /Generated feed validation failed/);
  assert.deepEqual(await f.snapshot(), before);
});

test("all empty responses remain a real refresh failure", async t => {
  const f = await fixture(t), before = await f.snapshot();
  await assert.rejects(refreshFeeds({ ...f, sleep: instant,
    generate: options => generateFeeds({ ...options, fetchFeed: async () => [] })
  }), /No feeds refreshed/);
  assert.deepEqual(await f.snapshot(), before);
});

test("a partial refresh explicitly reports cached feeds without changing their timestamps", async t => {
  const f = await fixture(t);
  const previous = JSON.parse(await readFile(path.join(f.destination, "manifest.json")));
  const status = await refreshFeeds({ ...f, sleep: instant,
    generate: options => generateFeeds({ ...options, fetchFeed: async (country, feed) => feed.key === "world" ? [] : [article()] })
  });
  assert.equal(status.state, "degraded");
  assert.equal(status.mode, "refreshed");
  assert.equal(status.refreshedFeeds, 9);
  assert.equal(status.cachedFeeds, 1);
  const current = JSON.parse(await readFile(path.join(f.destination, "manifest.json")));
  assert.equal(current.countries[0].feeds.world.updatedAt, previous.countries[0].feeds.world.updatedAt);
});

test("a first healthy publication can be created without any prior cache", async t => {
  const f = await fixture(t);
  await rm(f.destination, { recursive: true });
  const status = await refreshFeeds({ ...f, sleep: instant,
    generate: options => generateFeeds({ ...options, fetchFeed: async () => [article()] })
  });
  assert.equal(status.state, "healthy");
  assert.equal(status.attempts, 1);
  assert.deepEqual((await checkCoverage(f)).issues, []);
});


test("articles that expire between schedules are pruned without expiring an otherwise valid feed", async t => {
  const f = await fixture(t);
  const file = path.join(f.destination, "countries/NI/top.json");
  const old = { ...article(), url: "https://example.com/old-story", publishedAt: new Date(Date.now() - 14 * 86_400_000 - 3600_000).toISOString() };
  const { articleID } = await import("../src/articleIdentity.js");
  old.id = articleID(old.url);
  await writeFile(file, JSON.stringify([article(), old]));
  const manifestFile = path.join(f.destination, "manifest.json");
  const previous = JSON.parse(await readFile(manifestFile));
  previous.countries[0].feeds.top.count = 2;
  await writeFile(manifestFile, JSON.stringify(previous));
  const status = await refreshFeeds({ ...f, sleep: instant, generate: unavailable });
  assert.equal(status.expiredArticlesRemoved, 1);
  assert.equal(status.mode, "cached");
  assert.equal(JSON.parse(await readFile(file)).length, 1);
  const current = JSON.parse(await readFile(manifestFile));
  assert.equal(current.countries[0].feeds.top.updatedAt, previous.countries[0].feeds.top.updatedAt);
  assert.equal(current.countries[0].feeds.top.stale, true);
  assert.deepEqual((await checkCoverage(f)).issues, []);
});

test("cached publication remains valid for a full day after publication, including across midnight", async t => {
  const f = await fixture(t), now = Date.now();
  const file = path.join(f.destination, "countries/NI/top.json");
  const { articleID } = await import("../src/articleIdentity.js");
  const nearExpiry = { ...article(), url: "https://example.com/near-expiry", publishedAt: new Date(now - 13.5 * 86_400_000).toISOString() };
  nearExpiry.id = articleID(nearExpiry.url);
  await writeFile(file, JSON.stringify([article(), nearExpiry]));
  const manifestFile = path.join(f.destination, "manifest.json");
  const original = JSON.parse(await readFile(manifestFile));
  original.countries[0].feeds.top.count = 2;
  await writeFile(manifestFile, JSON.stringify(original));
  const status = await refreshFeeds({ ...f, sleep: instant, now: () => now, generate: unavailable });
  assert.equal(status.expiredArticlesRemoved, 0);
  assert.equal(status.expiringArticlesRemoved, 1);
  assert.equal(status.publicationSafetyHours, 24);
  assert.equal(JSON.parse(await readFile(file)).length, 1);
  assert.deepEqual((await checkCoverage({ ...f, now: now + 24 * 3600_000 })).issues, []);
  const current = JSON.parse(await readFile(manifestFile));
  assert.equal(current.countries[0].feeds.top.updatedAt, original.countries[0].feeds.top.updatedAt);
});

test("new output must satisfy the publication freshness margin before replacing valid feeds", async t => {
  const f = await fixture(t), before = await f.snapshot();
  await assert.rejects(refreshFeeds({ ...f, sleep: instant, generate: async ({ destination }) => {
    const file = path.join(destination, "countries/NI/top.json");
    const articles = JSON.parse(await readFile(file));
    articles[0].publishedAt = new Date(Date.now() - 13.5 * 86_400_000).toISOString();
    await writeFile(file, JSON.stringify(articles));
    return { succeeded: 10, manifest: { generatedAt: new Date().toISOString() } };
  } }), /Generated feed validation failed/);
  assert.deepEqual(await f.snapshot(), before);
});
