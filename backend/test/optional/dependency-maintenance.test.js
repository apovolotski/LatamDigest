import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { assertCompatibleLockfile, repairDependencyAudit } from "../../scripts/repair-dependency-audit.mjs";

const lock = value => ({ name: "fixture", lockfileVersion: 3, packages: {
  "": { dependencies: { qs: "^6.16.0" } },
  "packages/static-feeds": { name: "fixture-feeds" },
  "node_modules/qs": { version: value, resolved: `https://registry.npmjs.org/qs/-/qs-${value}.tgz` }
} });
const audit = count => ({ status: count ? 1 : 0, stdout: JSON.stringify({ metadata: { vulnerabilities: { total: count } } }) });
async function fixture(t) {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), "latam-security-maintenance-"));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await fs.mkdir(path.join(cwd, "packages/static-feeds"), { recursive: true });
  for (const name of ["package.json", "packages/static-feeds/package.json"]) await fs.writeFile(path.join(cwd, name), "{}\n");
  await fs.writeFile(path.join(cwd, "package-lock.json"), JSON.stringify(lock("6.16.0")));
  return { cwd, outputFile: path.join(cwd, "outputs"), readLock: () => fs.readFile(path.join(cwd, "package-lock.json"), "utf8") };
}

test("clean audits do not change the lockfile or request a repair", async t => {
  const f = await fixture(t), before = await f.readLock();
  let calls = 0;
  const result = await repairDependencyAudit({ ...f, run: async args => { calls++; assert.deepEqual(args, ["audit", "--omit=dev", "--json"]); return audit(0); } });
  assert.equal(calls, 1); assert.equal(result.changed, false); assert.equal(await f.readLock(), before);
  assert.match(await fs.readFile(f.outputFile, "utf8"), /has-updates=false/);
});

test("a compatible audited repair emits the exact candidate hash for validation", async t => {
  const f = await fixture(t); let calls = 0;
  const result = await repairDependencyAudit({ ...f, run: async args => {
    if (++calls === 1) return audit(2);
    if (calls === 2) {
      assert.deepEqual(args, ["audit", "fix", "--package-lock-only", "--ignore-scripts", "--json"]);
      await fs.writeFile(path.join(f.cwd, "package-lock.json"), JSON.stringify(lock("6.17.0")));
      return { status: 0, stdout: "" };
    }
    return audit(0);
  } });
  assert.equal(calls, 3); assert.equal(result.changed, true);
  assert.equal(result.sha256, createHash("sha256").update(await f.readLock()).digest("hex"));
  assert.match(await fs.readFile(f.outputFile, "utf8"), /has-updates=true/);
});

test("an unfixable audit restores the original lock and emits no publishable output", async t => {
  const f = await fixture(t), before = await f.readLock(); let calls = 0;
  await assert.rejects(repairDependencyAudit({ ...f, run: async () => {
    if (++calls === 2) { await fs.writeFile(path.join(f.cwd, "package-lock.json"), JSON.stringify(lock("6.17.0"))); return { status: 1 }; }
    return audit(2);
  } }), /No fully clean compatible repair/);
  assert.equal(await f.readLock(), before); await assert.rejects(fs.readFile(f.outputFile), { code: "ENOENT" });
});

test("breaking upgrades, downgrades, non-registry packages and workspace changes are blocked", () => {
  assert.throws(() => assertCompatibleLockfile(lock("6.16.0"), lock("7.0.0")), /breaking/);
  assert.throws(() => assertCompatibleLockfile(lock("6.16.0"), lock("6.15.0")), /downgrade/);
  const remote = lock("6.17.0"); remote.packages["node_modules/qs"].resolved = "https://untrusted.example/package.tgz";
  assert.throws(() => assertCompatibleLockfile(lock("6.16.0"), remote), /non-registry/);
  const workspace = lock("6.17.0"); workspace.packages[""].dependencies.qs = "*";
  assert.throws(() => assertCompatibleLockfile(lock("6.16.0"), workspace), /workspace/);
  assert.throws(() => assertCompatibleLockfile(lock("0.1.0"), lock("0.2.0")), /breaking/);
});

test("manifest mutation is rejected and restored before publication", async t => {
  const f = await fixture(t), before = await f.readLock(); let calls = 0;
  await assert.rejects(repairDependencyAudit({ ...f, run: async () => {
    if (++calls === 1) return audit(2);
    await fs.writeFile(path.join(f.cwd, "package.json"), '{"changed":true}');
    await fs.writeFile(path.join(f.cwd, "package-lock.json"), JSON.stringify(lock("6.17.0")));
    return { status: 0 };
  } }), /package manifest/);
  assert.equal(await f.readLock(), before); assert.equal(await fs.readFile(path.join(f.cwd, "package.json"), "utf8"), "{}\n");
});

test("audit transport errors fail safely without exposing tool output", async t => {
  const f = await fixture(t), before = await f.readLock();
  await assert.rejects(repairDependencyAudit({ ...f, run: async () => ({ status: 1, stdout: '{"error":"private-provider-secret"}' }) }), error =>
    error.message.includes("could not be verified") && !error.message.includes("private-provider-secret"));
  assert.equal(await f.readLock(), before);
});
