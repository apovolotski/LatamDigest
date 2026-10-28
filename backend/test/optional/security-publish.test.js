import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const script = fileURLToPath(new URL("../../scripts/publish-security-lock.sh", import.meta.url));
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "latam-publish-security-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const cwd = path.join(root, "checkout"), remote = path.join(root, "remote.git");
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  git("init", "--bare", "--initial-branch=main", remote);
  git("clone", remote, cwd);
  git("-C", cwd, "config", "user.name", "Fixture"); git("-C", cwd, "config", "user.email", "fixture@example.com");
  await fs.mkdir(path.join(cwd, "backend"));
  await fs.writeFile(path.join(cwd, "backend/package-lock.json"), "old-lock\n");
  await fs.writeFile(path.join(cwd, "backend/source.js"), "original\n");
  git("-C", cwd, "add", "."); git("-C", cwd, "commit", "-m", "Fixture"); git("-C", cwd, "push", "origin", "main");
  const source = git("-C", cwd, "rev-parse", "HEAD"), lockFile = path.join(root, "candidate.json");
  await fs.writeFile(lockFile, "validated-lock\n");
  const hash = createHash("sha256").update("validated-lock\n").digest("hex");
  const publish = overrides => spawnSync("bash", [script], { cwd, encoding: "utf8", env: {
    ...process.env, SOURCE_REVISION: source, LOCK_FILE: lockFile, LOCK_SHA256: hash, ...overrides
  } });
  return { cwd, remote, git, source, publish, lockFile };
}

test("verified security publishing preserves concurrent feed-only commits", async t => {
  const f = await fixture(t);
  await fs.mkdir(path.join(f.cwd, "docs")); await fs.writeFile(path.join(f.cwd, "docs/feed.json"), "latest-feed\n");
  f.git("-C", f.cwd, "add", "docs"); f.git("-C", f.cwd, "commit", "-m", "Concurrent feed refresh"); f.git("-C", f.cwd, "push", "origin", "main");
  const result = f.publish(); assert.equal(result.status, 0, result.stderr);
  assert.equal(f.git("--git-dir", f.remote, "show", "main:backend/package-lock.json"), "validated-lock");
  assert.equal(f.git("--git-dir", f.remote, "show", "main:docs/feed.json"), "latest-feed");
  assert.equal(f.git("--git-dir", f.remote, "diff-tree", "--no-commit-id", "--name-only", "-r", "main"), "backend/package-lock.json");
});

test("artifact tampering is rejected without changing main", async t => {
  const f = await fixture(t); await fs.writeFile(f.lockFile, "tampered\n");
  assert.notEqual(f.publish().status, 0); assert.equal(f.git("--git-dir", f.remote, "rev-parse", "main"), f.source);
});

test("concurrent backend changes require fresh validation and cannot be overwritten", async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.cwd, "backend/source.js"), "new-owner-work\n");
  f.git("-C", f.cwd, "add", "backend/source.js"); f.git("-C", f.cwd, "commit", "-m", "Concurrent backend work"); f.git("-C", f.cwd, "push", "origin", "main");
  const head = f.git("--git-dir", f.remote, "rev-parse", "main"), result = f.publish();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Backend changed after validation/);
  assert.equal(f.git("--git-dir", f.remote, "rev-parse", "main"), head);
  assert.equal(f.git("--git-dir", f.remote, "show", "main:backend/source.js"), "new-owner-work");
});
