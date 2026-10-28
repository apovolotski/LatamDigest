import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const backend = fileURLToPath(new URL("..", import.meta.url));

function version(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  if (!match) throw new Error("Automatic security repair requires stable package versions.");
  return match.slice(1).map(Number);
}

export function assertCompatibleLockfile(before, after) {
  const metadata = lock => Object.fromEntries(Object.entries(lock).filter(([key]) => key !== "packages"));
  assert.deepEqual(metadata(after), metadata(before), "Security repair changed lockfile identity or format.");
  for (const [name, entry] of Object.entries(before.packages)) {
    if (!name.includes("node_modules/")) {
      assert.deepEqual(after.packages[name], entry, "Security repair changed a workspace declaration.");
    }
  }
  for (const [name, entry] of Object.entries(after.packages)) {
    const previous = before.packages[name];
    if (JSON.stringify(entry) === JSON.stringify(previous)) continue;
    if (!name.includes("node_modules/") || entry.link) throw new Error("Security repair changed an unsupported package path.");
    const next = version(entry.version);
    if (!entry.resolved?.startsWith("https://registry.npmjs.org/")) throw new Error("Security repair introduced a non-registry package.");
    if (previous) {
      const old = version(previous.version);
      const difference = next.map((part, index) => part - old[index]).find(value => value !== 0) ?? 0;
      if (next[0] !== old[0] || (old[0] === 0 && next[1] !== old[1]) || difference < 0) {
        throw new Error("Security repair requires a breaking upgrade or downgrade; manual review is required.");
      }
    }
  }
}

function auditCount(result) {
  let report;
  try { report = JSON.parse(result.stdout); } catch { /* Do not print raw provider/tool errors. */ }
  const count = report?.metadata?.vulnerabilities?.total;
  if (!Number.isInteger(count) || count < 0 || ![0, 1].includes(result.status) ||
      (count === 0) !== (result.status === 0)) {
    throw new Error("Dependency audit could not be verified; no automatic update will be published.");
  }
  return count;
}

export async function repairDependencyAudit({ cwd = backend, run, outputFile = process.env.GITHUB_OUTPUT } = {}) {
  run ??= async args => {
    const result = spawnSync("npm", args, { cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 5_000_000 });
    if (result.error) throw new Error("Dependency tool did not complete; no automatic update will be published.");
    return { status: result.status, stdout: result.stdout };
  };
  const lockfile = path.join(cwd, "package-lock.json");
  const original = await fs.readFile(lockfile, "utf8");
  const manifests = await Promise.all(["package.json", "packages/static-feeds/package.json"].map(async name =>
    [path.join(cwd, name), await fs.readFile(path.join(cwd, name), "utf8")]));
  const emit = async changed => {
    const bytes = await fs.readFile(lockfile);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (outputFile) await fs.appendFile(outputFile, `has-updates=${changed}\nlock-sha256=${sha256}\n`);
    return { changed, sha256 };
  };
  try {
    if (auditCount(await run(["audit", "--omit=dev", "--json"])) === 0) return await emit(false);
    const fixed = await run(["audit", "fix", "--package-lock-only", "--ignore-scripts", "--json"]);
    if (![0, 1].includes(fixed.status)) throw new Error("Compatible dependency repair did not complete.");
    for (const [file, contents] of manifests) {
      if (await fs.readFile(file, "utf8") !== contents) throw new Error("Automatic security repair changed a package manifest.");
    }
    const candidate = await fs.readFile(lockfile, "utf8");
    assertCompatibleLockfile(JSON.parse(original), JSON.parse(candidate));
    if (auditCount(await run(["audit", "--omit=dev", "--json"])) !== 0) {
      throw new Error("No fully clean compatible repair is available; manual review is required.");
    }
    return await emit(candidate !== original);
  } catch (error) {
    await fs.writeFile(lockfile, original);
    for (const [file, contents] of manifests) await fs.writeFile(file, contents);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await repairDependencyAudit();
    console.log(result.changed
      ? "Compatible security update prepared. Both validation jobs must pass before publication."
      : "Dependency audit clean; no update needed.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
