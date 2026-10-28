import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { latestSlot, recoveryDecision, recordScheduled, validateHealth, mainRun } from "../../src/watchdogPolicy.js";
import { GitHub, Ledger, reserveAndDispatch, coverage, decodeJSON } from "../../scripts/hosted-watchdog.mjs";

const HOUR = 3_600_000;
const now = Date.parse("2026-10-28T20:30:00Z");
const repository = "apovolotski/LatamDigest";
const success = (created = "2026-10-28T12:00:00Z") => ({ id: 10, run_attempt: 1,
  status: "completed", conclusion: "success", event: "schedule", created_at: created,
  head_branch: "main", head_repository: { full_name: repository } });
const publication = (age = 8) => ({ valid: true, commit: "a".repeat(40), oldestUpdatedAt: now - age * HOUR, expiresAt: now + 10 * HOUR });
const decide = overrides => recoveryDecision({ kind: "feeds", now, runs: [success()], publication: publication(), receipts: {}, ...overrides });
const seed = () => ({ schemaVersion: 1, repository, cutoff: "2026-10-28T18:29:36Z", inspected: {}, receipts: {}, alerts: {},
  milestone: Object.fromEntries(["backend", "feeds"].map(kind => [kind, { runIds: [], attempts: {}, history: [] }])) });

test("Linux realpaths cannot activate the imported validator's CLI or pollute its JSON", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "watchdog-realpath-test-"));
  const directory = await fs.realpath(temporary); // Reproduce Linux even on a symlinked macOS tmpdir.
  try {
    const scripts = path.join(directory, "backend/scripts"); await fs.mkdir(scripts, { recursive: true });
    const module = path.join(scripts, "check-feed-coverage.mjs");
    await fs.writeFile(module, `import {pathToFileURL} from 'node:url';
      export async function checkCoverage(options){return {total:240,populated:240,issues:[],time:options.now,margin:options.minimumFreshnessMs};}
      if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log('Coverage: human-readable CLI output');`);
    const old = `import {pathToFileURL} from 'node:url';const {checkCoverage}=await import(pathToFileURL(process.argv[1]));console.log(JSON.stringify(await checkCoverage({})));`;
    const oldOutput = execFileSync("node", ["--input-type=module", "-e", old, module], { encoding: "utf8" });
    assert.throws(() => JSON.parse(oldOutput));
    const result = await coverage(directory, now, 86_400_000);
    assert.deepEqual(result, { total: 240, populated: 240, issues: [], time: now, margin: 86_400_000 });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
});

test("invalid JSON diagnostics identify the operation without exposing source contents", () => {
  assert.throws(() => decodeJSON('private-provider-secret', 'coverage report'), error =>
    error.message.includes('coverage report') && !error.message.includes('private-provider-secret'));
});

test("UTC schedules handle exact slots, midnight, month/year boundaries and leap days", () => {
  for (const [kind, at, expected] of [
    ["feeds", "2026-10-28T18:16:59Z", "2026-10-28T12:17:00.000Z"],
    ["feeds", "2026-10-28T18:17:00Z", "2026-10-28T18:17:00.000Z"],
    ["feeds", "2027-01-01T00:05:00Z", "2026-12-31T18:17:00.000Z"],
    ["backend", "2026-11-01T10:42:59Z", "2026-10-31T10:43:00.000Z"],
    ["backend", "2026-11-01T10:43:00Z", "2026-11-01T10:43:00.000Z"],
    ["backend", "2028-03-01T01:00:00Z", "2028-02-29T10:43:00.000Z"]
  ]) assert.equal(latestSlot(kind, Date.parse(at)), expected);
  assert.throws(() => latestSlot("unknown", now));
  assert.throws(() => latestSlot("feeds", NaN));
});

test("privileged monitor excludes fork, PR and non-main run histories", () => {
  assert.equal(mainRun(success(), repository), true);
  assert.equal(mainRun({ ...success(), event: "pull_request" }, repository), false);
  assert.equal(mainRun({ ...success(), head_branch: "feature" }, repository), false);
  assert.equal(mainRun({ ...success(), head_repository: { full_name: "outside/fork" } }, repository), false);
  assert.equal(mainRun({ ...success(), head_repository: null }, repository), false);
});

for (const status of ["queued", "in_progress", "pending", "waiting", "requested", "action_required"]) {
  test(`${status} main run prevents even an explicit dispatch exercise`, () => {
    assert.equal(decide({ runs: [{ ...success(), status }], exercise: "123" }).reason, "run_active");
  });
}

test("feed catch-up requires both grace and the 7.5-hour age threshold", () => {
  assert.equal(decide({ now: Date.parse("2026-10-28T19:00:00Z") }).reason, "schedule_grace");
  assert.equal(decide({ publication: publication(7.49) }).reason, "publication_current");
  assert.equal(decide({ publication: publication(7.5) }).dispatch, true);
  assert.equal(decide().reason, "late_schedule");
});

test("invalid or imminently expiring feeds can recover before schedule grace ends", () => {
  assert.equal(decide({ publication: { ...publication(), valid: false } }).reason, "publication_invalid_or_expiring");
  assert.equal(decide({ publication: { ...publication(1), expiresAt: now + HOUR } }).dispatch, true);
  assert.equal(decide({ publication: { ...publication(1), expiresAt: now + HOUR + 1 } }).dispatch, false);
});

test("a new native run wins the race and suppresses a duplicate catch-up", () => {
  assert.equal(decide({ runs: [{ ...success(), status: "queued" }] }).dispatch, false);
  assert.equal(decide({ runs: [success()], publication: publication(0.1) }).dispatch, false);
});

test("backend daily coverage accepts manual or push success without counting it as scheduled", () => {
  for (const event of ["workflow_dispatch", "push", "schedule"]) {
    const result = decide({ kind: "backend", runs: [{ ...success("2026-10-28T17:51:00Z"), event }] });
    assert.equal(result.reason, "daily_check_covered");
  }
  assert.equal(decide({ kind: "backend", runs: [success("2026-10-27T17:51:00Z")] }).dispatch, true);
});

test("failed runs get one bounded recovery regardless of the daily due time", () => {
  const failed = { ...success(), conclusion: "failure" };
  const first = decide({ runs: [failed] });
  assert.equal(first.reason, "failed_run");
  assert.equal(decide({ runs: [failed], receipts: { [first.key]: { kind: "feeds", reservedAt: new Date(now - 12 * HOUR).toISOString() } } }).reason, "already_reserved");
});

test("six-hour feed and 24-hour backend cooldowns include uncertain writes", () => {
  for (const [kind, hours] of [["feeds", 6], ["backend", 24]]) {
    const receipts = { previous: { kind, status: "uncertain_or_rejected", reservedAt: new Date(now - (hours - 0.01) * HOUR).toISOString() } };
    assert.equal(decide({ kind, runs: [], receipts }).reason, "cooldown");
    receipts.previous.reservedAt = new Date(now - hours * HOUR).toISOString();
    assert.equal(decide({ kind, runs: [], receipts }).dispatch, true);
  }
});

test("dispatch exercises are uniquely identified and never repeat a reserved probe", () => {
  const first = decide({ exercise: "12345", publication: publication(0.1) });
  assert.equal(first.key, "probe-12345-feeds");
  assert.equal(decide({ exercise: "12345", receipts: { [first.key]: {} } }).reason, "already_reserved");
  assert.throws(() => decide({ exercise: "shell;code" }));
});

test("milestone counts scheduled identities once and carries on after four", () => {
  const state = seed();
  for (const event of ["workflow_dispatch", "push", "pull_request"]) {
    recordScheduled(state, "feeds", { ...success("2026-10-28T19:00:00Z"), event }, new Date(now).toISOString());
  }
  assert.equal(state.milestone.feeds.runIds.length, 0);
  for (let id = 1; id <= 6; id++) {
    const run = { ...success("2026-10-28T19:00:00Z"), id };
    recordScheduled(state, "feeds", run, new Date(now).toISOString());
    recordScheduled(state, "feeds", run, new Date(now).toISOString());
  }
  assert.deepEqual(state.milestone.feeds.runIds, [1, 2, 3, 4]);
  assert.ok(state.milestone.feeds.completedAt);
  assert.equal(state.status, undefined); // No stop/delete state is generated.
});

test("cutoff uses actual instants, including subsecond scheduled creations", () => {
  const state = seed();
  recordScheduled(state, "feeds", success("2026-10-28T18:29:36Z"), new Date(now).toISOString());
  assert.equal(state.milestone.feeds.runIds.length, 0);
  recordScheduled(state, "feeds", success("2026-10-28T18:29:36.100Z"), new Date(now).toISOString());
  assert.deepEqual(state.milestone.feeds.runIds, [10]);
});

test("scheduled failure preserves an interrupted window and a repaired attempt is distinct", () => {
  const state = seed();
  recordScheduled(state, "feeds", success("2026-10-28T19:00:00Z"), new Date(now).toISOString());
  const failed = { ...success("2026-10-28T19:30:00Z"), id: 11, conclusion: "failure" };
  recordScheduled(state, "feeds", failed, new Date(now).toISOString());
  assert.deepEqual(state.milestone.feeds.history[0].runIds, [10]);
  assert.deepEqual(state.milestone.feeds.runIds, []);
  recordScheduled(state, "feeds", { ...failed, run_attempt: 2, conclusion: "success" }, new Date(now).toISOString());
  assert.deepEqual(state.milestone.feeds.runIds, [11]);
});

function healthFixture() {
  const generatedAt = new Date(now - HOUR).toISOString();
  return {
    now, manifest: { generatedAt, countries: Array.from({ length: 24 }, (_, id) => ({ id, feeds:
      Object.fromEntries(Array.from({ length: 10 }, (_, key) => [key, { updatedAt: generatedAt, stale: false }])) })) },
    health: { checkedAt: generatedAt, lastSuccessfulRefreshAt: generatedAt, state: "healthy", mode: "refreshed",
      totalFeeds: 240, refreshedFeeds: 240, cachedFeeds: 0, publicationSafetyHours: 24, cacheLimitHours: 24 }
  };
}

test("current 240-feed health is truthful and its earliest expiry is tracked", () => {
  const fixture = healthFixture();
  assert.equal(validateHealth(fixture).valid, true);
  assert.equal(validateHealth({ ...fixture, articleExpiry: now + HOUR }).expiresAt, now + HOUR);
});

test("recent manifest cannot hide an expired cache or renewed safety limit", () => {
  const fixture = healthFixture();
  fixture.manifest.countries[0].feeds[0].updatedAt = new Date(now - 25 * HOUR).toISOString();
  fixture.manifest.countries[0].feeds[0].stale = true;
  fixture.health.state = "degraded"; fixture.health.refreshedFeeds--; fixture.health.cachedFeeds++;
  assert.equal(validateHealth(fixture).valid, false);
  fixture.health.cacheLimitHours = 168;
  assert.match(validateHealth(fixture).issues.join(" "), /safety limits/);
});

test("supported degraded recovery preserves feed age and truthful cached counts", () => {
  const fixture = healthFixture();
  fixture.manifest.countries[0].feeds[0] = { updatedAt: new Date(now - 20 * HOUR).toISOString(), stale: true };
  fixture.health.state = "degraded"; fixture.health.refreshedFeeds = 239; fixture.health.cachedFeeds = 1;
  const result = validateHealth(fixture);
  assert.equal(result.valid, true); assert.equal(result.expiresAt, now + 4 * HOUR);
  fixture.health.state = "healthy";
  assert.equal(validateHealth(fixture).valid, false);
});

test("future, invalid, incomplete and non-truthful timestamps fail closed", () => {
  for (const mutate of [
    f => { f.manifest.countries[0].feeds[0].updatedAt = "invalid"; },
    f => { f.manifest.countries[0].feeds[0].updatedAt = new Date(now + HOUR).toISOString(); },
    f => { f.manifest.countries.pop(); },
    f => { f.health.lastSuccessfulRefreshAt = new Date(now).toISOString(); },
    f => { f.health.mode = "cached"; },
    f => { f.health.refreshedFeeds = 1; }
  ]) {
    const fixture = healthFixture(); mutate(fixture); assert.equal(validateHealth(fixture).valid, false);
  }
});

test("API writes are never retried after uncertain transport, and errors omit credentials", async () => {
  let calls = 0;
  const api = new GitHub({ repository, token: "private-test-value", transport: async () => { calls++; throw new Error("private-test-value"); } });
  await assert.rejects(api.request("actions/workflows/x/dispatches", { method: "POST", body: {} }), error => !error.message.includes("private-test-value"));
  assert.equal(calls, 1);
  await assert.rejects(api.request("actions/workflows/x")); assert.equal(calls, 4);
});

test("API errors and unsupported repositories never expose response bodies or tokens", async () => {
  assert.throws(() => new GitHub({ repository: "bad/repo/../other", token: "secret" }));
  const api = new GitHub({ repository, token: "private-test-value", transport: async () => ({ ok: false, status: 403, json: () => ({ secret: "private-test-value" }) }) });
  await assert.rejects(api.request("actions"), /HTTP 403/);
});

test("durable reservation precedes dispatch and a repeated tick makes no second POST", async () => {
  const state = seed(); const order = [];
  const api = { runs: async () => [success()], request: async (_endpoint, { body }) => { order.push("dispatch"); assert.equal(body.inputs.maintenance_key, Object.keys(state.receipts)[0]); } };
  const ledger = { save: async () => order.push("save") };
  await reserveAndDispatch({ api, ledger, state, kind: "feeds", publication: publication(), now });
  assert.deepEqual(order, ["save", "dispatch", "save"]);
  await reserveAndDispatch({ api, ledger, state, kind: "feeds", publication: publication(), now });
  assert.equal(order.filter(item => item === "dispatch").length, 1);
});

test("state CAS failure prevents dispatch; uncertain dispatch retains its reservation", async () => {
  let posts = 0;
  const state = seed(); const api = { runs: async () => [success()], request: async () => { posts++; throw new Error("transport unavailable"); } };
  await assert.rejects(reserveAndDispatch({ api, ledger: { save: async () => { throw new Error("CAS conflict"); } }, state,
    kind: "feeds", publication: publication(), now }), /CAS conflict/);
  assert.equal(posts, 0);
  const next = seed(); const ledger = { save: async () => {} };
  await assert.rejects(reserveAndDispatch({ api, ledger, state: next, kind: "feeds", publication: publication(), now }), /transport unavailable/);
  assert.equal(Object.values(next.receipts)[0].status, "uncertain_or_rejected");
  await reserveAndDispatch({ api, ledger, state: next, kind: "feeds", publication: publication(), now });
  assert.equal(posts, 1);
});

test("re-query of active runs prevents a race even when the initial scan was empty", async () => {
  const api = { runs: async () => [{ ...success(), status: "in_progress" }], request: async () => assert.fail("must not dispatch") };
  const result = await reserveAndDispatch({ api, ledger: { save: async () => assert.fail("must not reserve") }, state: seed(),
    kind: "feeds", publication: publication(), now });
  assert.equal(result.reason, "run_active");
});

test("a green run with invalid verification cannot suppress backend recovery", async () => {
  const state = seed(); state.inspected["10:1"] = { valid: false };
  const api = { runs: async () => [success("2026-10-28T19:00:00Z")], request: async () => {} };
  const result = await reserveAndDispatch({ api, ledger: { save: async () => {} }, state,
    kind: "backend", publication: publication(), now });
  assert.equal(result.reason, "failed_run");
});

test("temporary GitHub service and rate-limit errors are distinguished from missing permission", async () => {
  for (const status of [503, 429, 403]) {
    const api = new GitHub({ repository, token: "private-test-value", transport: async () => ({ ok: false, status }) });
    await assert.rejects(api.request("actions"), error => error.transient === (status !== 403));
  }
});

test("an existing hosted ledger is decoded without creating another branch or losing receipts", async () => {
  const state = seed(); state.receipts.old = { status: "completed" };
  const api = { repository, request: async (_endpoint, options) => {
    assert.equal(options.missing, true);
    return { sha: "c".repeat(40), content: Buffer.from(JSON.stringify(state)).toString("base64") };
  } };
  const ledger = new Ledger(api); assert.deepEqual(await ledger.load(seed()), state);
  assert.equal(ledger.sha, "c".repeat(40));
});

test("hosted ledger uses a separate branch, CAS updates and no local file paths", async () => {
  const calls = [];
  const api = { repository, request: async (endpoint, options) => {
    calls.push({ endpoint, options });
    if (endpoint.includes("contents") && options?.method !== "PUT") return null;
    if (endpoint.includes("git/ref/heads/latam-monitor")) return null;
    if (endpoint === "git/ref/heads/main") return { object: { sha: "a".repeat(40) } };
    return { content: { sha: "b".repeat(40) } };
  } };
  const ledger = new Ledger(api); const state = await ledger.load(seed()); await ledger.save(state); await ledger.save(state);
  const writes = calls.filter(call => call.options?.method === "PUT");
  assert.equal(writes.length, 2); assert.equal(writes[0].options.body.branch, "latam-monitor-state");
  assert.equal(writes[0].options.body.sha, undefined); assert.equal(writes[1].options.body.sha, "b".repeat(40));
  assert.equal(Buffer.from(writes[0].options.body.content, "base64").toString().includes("/Users/"), false);
});

test("privileged completion trigger checks trusted main and never checks out PR code", async () => {
  const workflow = await fs.readFile(new URL("../../../.github/workflows/hosted-maintenance.yml", import.meta.url), "utf8").catch(() =>
    fs.readFile(new URL("../../../../.github/workflows/hosted-maintenance.yml", import.meta.url), "utf8"));
  assert.match(workflow, /head_repository\.full_name == github\.repository/);
  assert.match(workflow, /head_branch == 'main'/); assert.match(workflow, /event != 'pull_request'/);
  assert.match(workflow, /ref: main/); assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /ref:.*head_sha|pull_request_target|OPENAI_API_KEY/);
});
