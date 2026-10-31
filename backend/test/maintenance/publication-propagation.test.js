import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compareAppFacing } from "../../scripts/hosted-watchdog.mjs";

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "latam-propagation-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, "docs/api"), { recursive: true });
  for (const name of ["manifest.json", "feed.json"]) await fs.writeFile(path.join(directory, "docs/api", name), '{"version":2}');
  let clock = 0;
  const waits = [];
  return { publication: { directory, relativeFiles: ["manifest.json", "feed.json"] }, waits,
    timing: { now: () => clock, sleep: async ms => { waits.push(ms); clock += ms; } } };
}

test("raw CDN propagation retries old bytes and never refetches already matched files", async t => {
  const f = await fixture(t), calls = { "manifest.json": 0, "feed.json": 0 };
  const count = await compareAppFacing(f.publication, { ...f.timing, fetchImpl: async url => {
    const name = url.split("/").at(-1); calls[name]++;
    assert.equal(new URL(url).search, ""); // Verify the actual app-facing URL.
    return new Response(name === "feed.json" && calls[name] < 3 ? '{"version":1}' : '{"version":2}');
  } });
  assert.equal(count, 2);
  assert.deepEqual(calls, { "manifest.json": 1, "feed.json": 3 });
  assert.deepEqual(f.waits, [30000, 30000]);
});

test("a persistent byte mismatch still fails after a bounded propagation interval", async t => {
  const f = await fixture(t);
  await assert.rejects(compareAppFacing(f.publication, { ...f.timing,
    fetchImpl: async () => new Response('{"version":1}') }), /App-facing publication mismatch or unavailable/);
  assert.equal(f.waits.reduce((a, b) => a + b, 0), 330000);
  assert(f.waits.every(ms => ms <= 30000));
});

test("transient raw transport errors can recover without substituting immutable or cache-busted URLs", async t => {
  const f = await fixture(t); let calls = 0;
  const count = await compareAppFacing(f.publication, { ...f.timing, fetchImpl: async url => {
    assert(url.includes('/main/docs/api/'));
    if (++calls <= 2) throw new Error("private transport diagnostic");
    return new Response('{"version":2}');
  } });
  assert.equal(count, 2);
  assert.deepEqual(f.waits, [30000]);
});
