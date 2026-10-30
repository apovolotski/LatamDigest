import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { WORKFLOWS, mainRun, recoveryDecision, recordScheduled, validateHealth } from "../src/watchdogPolicy.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const stateBranch = "latam-monitor-state";
const statePath = "monitor/state.json";
const hash = data => createHash("sha256").update(data).digest("hex");
const iso = now => new Date(now).toISOString();
export const INSPECTION_VERSION = 5;
export const needsInspection = previous => !previous ||
  (previous.valid === false && (previous.inspectionVersion ?? 1) < INSPECTION_VERSION);
export function recordInspection(state, run, inspected) {
  const key = `${run.id}:${run.run_attempt}`;
  const previous = state.inspected[key];
  if (previous) inspected.verificationHistory = [...(previous.verificationHistory ?? []), {
    inspectionVersion: previous.inspectionVersion ?? 1, verifiedAt: previous.verifiedAt,
    valid: previous.valid, issues: previous.issues, completeLogSha256: previous.completeLogSha256
  }];
  state.inspected[key] = Object.fromEntries(Object.entries(inspected)
    .filter(([field]) => !["annotations", "publication"].includes(field)));
}
export function decodeJSON(value, context) {
  try { return JSON.parse(value); }
  catch { throw new Error(`Invalid JSON in ${context}; source contents are not logged.`); }
}
export function receiptFromLogs(logs) {
  const values = [...new Set([...logs.matchAll(/Maintenance receipt: ([A-Za-z0-9-]{1,120})(?:\s|$)/g)].map(match => match[1]))];
  if (values.length > 1) throw new Error("Conflicting hosted dispatch receipts in run logs.");
  return values[0];
}
const runCommand = (command, args, options = {}) => {
  try { return execFileSync(command, args, { cwd: root, encoding: "utf8", timeout: 60_000, maxBuffer: 32_000_000, ...options }); }
  catch (error) {
    const status = /HTTP (\d{3})/.exec(error.stderr?.toString() ?? "")?.[1];
    throw Object.assign(new Error(`Monitor ${command} operation failed${status ? ` (HTTP ${status})` : ""}; inspect the associated workflow, not raw provider output.`), {
      transient: status === "429" || Number(status) >= 500
    });
  }
};

export class GitHub {
  constructor({ repository, token, transport = fetch }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !token) throw new Error("Repository-scoped GitHub access is required.");
    this.repository = repository;
    this.token = token;
    this.transport = transport;
  }
  async request(endpoint, { method = "GET", body, missing = false } = {}) {
    // Writes, particularly dispatches, are never automatically retried after an
    // ambiguous response. A reserved receipt survives runner loss or timeout.
    for (let attempt = 0; ; attempt++) {
      let response;
      try {
        response = await this.transport(`https://api.github.com/repos/${this.repository}/${endpoint}`, {
          method, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
          body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000), redirect: "error"
        });
      } catch {
        if (method === "GET" && attempt < 2) continue;
        throw Object.assign(new Error(`GitHub ${method} transport unavailable; an uncertain write will not be repeated.`), { transient: true });
      }
      if (missing && response.status === 404) return null;
      if (method === "GET" && response.status >= 500 && attempt < 2) continue;
      if (!response.ok) throw Object.assign(new Error(`GitHub ${method} request failed (HTTP ${response.status}); access or service review required.`), {
        transient: response.status >= 500 || response.status === 429 || (response.status === 403 && response.headers?.get("x-ratelimit-remaining") === "0")
      });
      return response.status === 204 ? null : decodeJSON(await response.text(), `GitHub ${method} ${endpoint}`);
    }
  }
  async pages(endpoint, field) {
    const result = [];
    for (let page = 1; page <= 20; page++) {
      const data = await this.request(`${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      const items = field ? data[field] : data;
      if (!Array.isArray(items)) throw new Error("Unexpected GitHub pagination response.");
      result.push(...items);
      if (items.length < 100) return result;
    }
    throw new Error("Monitor pagination limit reached; refusing an incomplete inspection.");
  }
  async runs(kind) {
    // Thirty days bounds work on recovery after an extended service interruption.
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    return (await this.pages(`actions/workflows/${WORKFLOWS[kind].file}/runs?branch=main&created=${encodeURIComponent(`>=${since}`)}`, "workflow_runs"))
      .filter(run => mainRun(run, this.repository));
  }
  async runLogs(run, jobs) {
    if (![run.id, run.run_attempt].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error("Invalid run log identity.");
    // Use the same run-archive transport as gh run view, but read its original
    // per-job files instead of the human-facing UNKNOWN STEP display labels.
    const endpoint = `repos/${this.repository}/actions/runs/${run.id}/attempts/${run.run_attempt}/logs`;
    const archive = runCommand("gh", ["api", endpoint], { encoding: null });
    return readJobLogArchive(archive, jobs);
  }
  workflowSource(kind, run) {
    if (!WORKFLOWS[kind] || !/^[a-f0-9]{40}$/.test(run.head_sha)) throw new Error("Invalid workflow source identity.");
    return runCommand("git", ["show", `${run.head_sha}:.github/workflows/${WORKFLOWS[kind].file}`]);
  }
}

export async function readJobLogArchive(archive, jobs) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "latam-job-logs-"));
  try {
    const file = path.join(directory, "logs.zip");
    await fs.writeFile(file, archive);
    const entries = runCommand("unzip", ["-Z1", file]).split(/\r?\n/);
    const logs = {};
    for (const job of jobs.filter(job => job.conclusion !== "skipped")) {
      const suffix = `_${job.name}.txt`;
      const matching = entries.filter(entry => /^\d+_[A-Za-z0-9_. -]+\.txt$/.test(entry) && entry.endsWith(suffix));
      if (matching.length !== 1) throw new Error(`Original log archive has missing or ambiguous evidence for job ${job.id}.`);
      // Never extract archive paths onto disk; only read the selected stdout file.
      logs[job.id] = runCommand("unzip", ["-p", file, matching[0]]);
    }
    return logs;
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

// Reviewed source contracts: these exact workflows run the required commands
// with bash -e and no continue-on-error. A source change must be reviewed and
// this contract regression updated before it can use the metadata fallback.
const blockingWorkflows = {
  backend: "28408fbf6dbaf28c6392cc18701ffe8405d5becf8908777c185a5cb09cc44003",
  feeds: "da3d2de6b1dcaba07902a7e3654a1fc28bff65ed7cb5702887d582b383fd0e44"
};
export function workflowContract(kind, source) {
  const sha256 = typeof source === "string" ? hash(source) : undefined;
  return sha256 && sha256 === blockingWorkflows[kind] ? { kind, sha256 } : undefined;
}

export function commandEvidence(jobs, jobLogs, spec, contract) {
  const matching = jobs.filter(job => job.name === spec.job), job = matching[0];
  if (matching.length !== 1 || job.conclusion !== "success") return;
  const raw = jobLogs[job.id] ?? "", rawLines = raw.split(/\r?\n/);
  const lines = rawLines.map(line => line.replace(/\uFEFF/g, "")
    .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").trim());
  const starts = lines.flatMap((line, i) => line === `##[group]Run ${spec.commands[0]}` ? [i] : []);
  if (starts.length !== 1) return;
  const start = starts[0], next = lines.findIndex((line, i) => i > start && line.startsWith("##[group]"));
  const block = lines.slice(start + 1, next < 0 ? undefined : next), headerEnd = block.indexOf("##[endgroup]");
  if (headerEnd < 0 || !spec.commands.every(command => block.slice(0, headerEnd).includes(command))) return;
  const steps = job.steps?.filter(step => step.name === spec.step) ?? [];
  const metadataMissing = Array.isArray(job.steps) && job.steps.length === 0;
  let source, stepNumber;
  if (!metadataMissing) {
    // Explicit skipped/failed/missing/ambiguous steps can never use fallback.
    if (steps.length !== 1 || steps[0].conclusion !== "success") return;
    source = "github-step-and-original-log"; stepNumber = steps[0].number;
  } else {
    if (!contract || contract.sha256 !== blockingWorkflows[contract.kind] ||
        !block.slice(0, headerEnd).includes("shell: /usr/bin/bash -e {0}")) return;
    source = "original-log-and-reviewed-blocking-workflow";
  }
  const output = block.slice(headerEnd + 1);
  if (output.some(line => /##\[error\]Process completed with exit code [1-9]/.test(line))) return;
  const timestamp = index => Date.parse(rawLines[index]?.replace(/\uFEFF/g, "").match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/)?.[1]);
  return { output, startedAt: timestamp(start), completedAt: timestamp(next),
    proof: { jobId: job.id, ...(stepNumber ? { stepNumber } : {}), source,
      ...(metadataMissing ? { workflowSha256: contract.sha256 } : {}),
      jobLogSha256: hash(raw), jobLogLines: rawLines.length } };
}

export function inspectAudits(kind, jobs, jobLogs, contract) {
  const scoped = "npm audit --omit=dev --workspace=@latam-digest/static-feeds --include-workspace-root=false";
  const specs = kind === "feeds" ? [{ job: "refresh", step: "Check pipeline", commands: [
    "npm run check --workspace=@latam-digest/static-feeds", "npm test --workspace=@latam-digest/static-feeds", scoped
  ] }] : [
    { job: "check", step: "Run npm audit --omit=dev", commands: ["npm audit --omit=dev"] },
    { job: "static-feeds", step: `Run ${scoped}`, commands: [scoped] }
  ];
  const audits = {}, evidence = {}, issues = [];
  for (const spec of specs) {
    const executed = commandEvidence(jobs, jobLogs, spec, contract?.kind === kind ? contract : undefined);
    // A clean install, another job, a skipped audit, or an echoed success
    // string cannot substitute for this successful production audit step.
    if (!executed?.output.includes("found 0 vulnerabilities")) {
      issues.push(`${spec.job}: missing clean production audit evidence.`);
      continue;
    }
    audits[spec.job] = 0;
    evidence[spec.job] = { ...executed.proof, command: spec.commands.at(-1) };
  }
  return { audits, evidence, issues };
}

// Test counts are minimum retained baselines, not an exact output format:
// adding a passing regression must not invalidate a healthy publication.
// Keep each summary inside its successful command and original job so a
// controller suite or another job cannot cover up missing feed/backend tests.
export function inspectTests(kind, jobs, jobLogs, contract) {
  const feedCheck = "npm run check --workspace=@latam-digest/static-feeds";
  const feedTest = "npm test --workspace=@latam-digest/static-feeds";
  const specs = kind === "feeds" ? [
    { job: "refresh", step: "Check pipeline", commands: [feedCheck, feedTest,
      "npm audit --omit=dev --workspace=@latam-digest/static-feeds --include-workspace-root=false"], minimum: 145, isolation: true }
  ] : [
    { job: "check", step: "Run npm test", commands: ["npm test"], minimum: 161 },
    { job: "static-feeds", step: `Run ${feedTest}`, commands: [feedTest], minimum: 145 },
    { job: "static-feeds", step: `Run ${feedCheck}`, commands: [feedCheck], isolation: true }
  ];
  const tests = {}, evidence = {}, issues = [];
  for (const spec of specs) {
    const executed = commandEvidence(jobs, jobLogs, spec, contract?.kind === kind ? contract : undefined);
    const output = executed?.output ?? [];
    const summary = {};
    for (const field of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
      const values = output.flatMap(line => {
        const match = new RegExp(`^(?:ℹ|#)\\s*${field}\\s+(\\d+)$`).exec(line);
        return match ? [Number(match[1])] : [];
      });
      if (values.length === 1) summary[field] = values[0];
    }
    const passed = !spec.minimum || (summary.pass >= spec.minimum && summary.tests === summary.pass &&
      ["fail", "cancelled", "skipped", "todo"].every(field => summary[field] === 0));
    const isolated = !spec.isolation || output.includes("Static feed dependency isolation verified; optional backend packages are absent.");
    if (!executed || !passed || !isolated) {
      issues.push(`${spec.job}: ${spec.minimum ? "retained test suite" : "dependency isolation"} evidence is incomplete.`);
      continue;
    }
    if (spec.minimum) tests[spec.job] = summary.pass;
    evidence[`${spec.job}:${executed.proof.stepNumber ?? spec.commands[0]}`] = { ...executed.proof,
      command: spec.commands.join("\n"), ...(spec.minimum ? { minimum: spec.minimum, summary } : {}),
      ...(spec.isolation ? { isolation: true } : {}) };
  }
  return { tests, evidence, issues };
}

export class Ledger {
  constructor(api) { this.api = api; }
  async load(seed) {
    const file = await this.api.request(`contents/${statePath}?ref=${stateBranch}`, { missing: true });
    if (file) {
      this.sha = file.sha;
      const state = decodeJSON(Buffer.from(file.content, "base64"), "hosted ledger");
      if (state.schemaVersion !== 1 || state.repository !== this.api.repository) throw new Error("Invalid hosted monitor ledger.");
      return state;
    }
    const ref = await this.api.request(`git/ref/heads/${stateBranch}`, { missing: true });
    if (!ref) {
      const main = await this.api.request("git/ref/heads/main");
      await this.api.request("git/refs", { method: "POST", body: { ref: `refs/heads/${stateBranch}`, sha: main.object.sha } });
    }
    return structuredClone(seed);
  }
  async save(state) {
    const result = await this.api.request(`contents/${statePath}`, { method: "PUT", body: {
      branch: stateBranch, message: "Record hosted workflow monitoring evidence",
      content: Buffer.from(JSON.stringify(state, null, 2) + "\n").toString("base64"), ...(this.sha ? { sha: this.sha } : {})
    } });
    this.sha = result.content.sha;
  }
}

export async function reserveAndDispatch({ api, ledger, state, kind, publication, now, exercise }) {
  // Re-read immediately before the decision: do not race a newly queued native run.
  const runs = (await api.runs(kind)).map(run => state.inspected[`${run.id}:${run.run_attempt}`]?.valid === false
    ? { ...run, conclusion: "invalid" } : run);
  const decision = recoveryDecision({ kind, now, runs, publication, receipts: state.receipts, exercise });
  if (!decision.dispatch) return decision;
  const receipt = { ...decision, reservedAt: iso(now), status: "reserved" };
  state.receipts[decision.key] = receipt;
  await ledger.save(state); // CAS failure here means no external dispatch occurs.
  try {
    await api.request(`actions/workflows/${WORKFLOWS[kind].file}/dispatches`, {
      method: "POST", body: { ref: "main", inputs: { maintenance_key: decision.key } }
    });
    receipt.status = "dispatched";
  } catch (error) {
    receipt.status = "uncertain_or_rejected";
    await ledger.save(state);
    throw error;
  }
  await ledger.save(state);
  return decision;
}

function snapshot(commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid publication revision.");
  const directory = execFileSync("mktemp", ["-d", path.join(os.tmpdir(), "latam-monitor-XXXXXX")], { encoding: "utf8" }).trim();
  const archive = runCommand("git", ["archive", commit, "docs/api", "backend/src", "backend/scripts/check-feed-coverage.mjs", "LatamDigest/Resources/Countries.json"], { encoding: null });
  runCommand("tar", ["-x", "-C", directory], { input: archive });
  return directory;
}

export async function coverage(directory, now, margin = 0) {
  // argv[1] must not be the imported coverage module: on Linux that makes
  // its standalone-CLI guard true and mixes human-readable output into JSON.
  // macOS /var -> /private/var realpath resolution had hidden that collision.
  const source = `import {pathToFileURL} from 'node:url'; const {checkCoverage}=await import(pathToFileURL(process.argv[2])); console.log(JSON.stringify(await checkCoverage({destination:process.argv[3],now:Number(process.argv[4]),minimumFreshnessMs:Number(process.argv[5])})));`;
  return decodeJSON(runCommand("node", ["--input-type=module", "-e", source,
    "watchdog-coverage-eval", path.join(directory, "backend/scripts/check-feed-coverage.mjs"), path.join(directory, "docs/api"), String(now), String(margin)]), "matching-source coverage report");
}

async function inspectPublication(commit, now, { publicationTime = false } = {}) {
  const directory = snapshot(commit);
  try {
    const destination = path.join(directory, "docs/api");
    const manifest = decodeJSON(await fs.readFile(path.join(destination, "manifest.json")), "published manifest");
    const health = decodeJSON(await fs.readFile(path.join(destination, "refresh-status.json")), "published health");
    const checked = Date.parse(health.checkedAt);
    // The matching source uses only built-in modules for coverage/relevance.
    const at = publicationTime ? checked : now;
    const report = await coverage(directory, at, publicationTime ? 86_400_000 : 0);
    const horizon = publicationTime ? await coverage(directory, checked + 86_400_000) : undefined;
    const dates = [];
    const relativeFiles = ["countries.json", "manifest.json", "refresh-status.json"];
    for (const country of manifest.countries) {
      for (const key of Object.keys(country.feeds)) {
        const relative = `countries/${country.id}/${["top", "latest"].includes(key) ? "" : "category/"}${key}.json`;
        if (!/^[\w/.-]+$/.test(relative) || relative.includes("..")) throw new Error("Unsafe publication path.");
        const articles = decodeJSON(await fs.readFile(path.join(destination, relative)), "published feed");
        dates.push(...articles.map(article => Date.parse(article.publishedAt) + 14 * 86_400_000));
        relativeFiles.push(relative);
      }
    }
    const consistency = validateHealth({ manifest, health, now: at, articleExpiry: Math.min(...dates) });
    const issues = [...report.issues, ...(horizon?.issues ?? []), ...consistency.issues];
    if (report.total !== 240 || report.populated !== 240) issues.push("Incomplete country/category coverage.");
    return { commit, valid: !issues.length, issues, report, horizon, health, manifest,
      oldestUpdatedAt: consistency.oldestUpdatedAt, expiresAt: consistency.expiresAt, relativeFiles,
      directory, cleanup: () => fs.rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function compareAppFacing(publication) {
  const files = publication.relativeFiles;
  let index = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (index < files.length) {
      const relative = files[index++];
      let matched = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/main/docs/api/${relative}`, { signal: AbortSignal.timeout(20_000) });
          if (!response.ok) continue;
          const actual = Buffer.from(await response.arrayBuffer());
          const expected = await fs.readFile(path.join(publication.directory, "docs/api", relative));
          matched = actual.equals(expected);
          if (matched) break;
        } catch { /* A CDN response must never expose raw network diagnostics. */ }
      }
      if (!matched) throw new Error(`App-facing publication mismatch or unavailable: ${relative}`);
    }
  }));
  return files.length;
}

export async function inspectRun(api, kind, run, now) {
  const jobs = await api.pages(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, "jobs");
  const annotations = [];
  for (const job of jobs) annotations.push(...await api.pages(`check-runs/${job.id}/annotations`));
  const jobLogs = await api.runLogs(run, jobs);
  const metadataMissing = jobs.filter(job => job.conclusion === "success" && job.steps?.length === 0).map(job => job.name);
  const contract = metadataMissing.length ? workflowContract(kind, await api.workflowSource?.(kind, run)) : undefined;
  const logs = [...jobs].sort((a, b) => a.id - b.id).map(job => jobLogs[job.id] ?? "").join("\n");
  const result = { id: run.id, attempt: run.run_attempt, event: run.event, createdAt: run.created_at,
    inspectionVersion: INSPECTION_VERSION, completeLogFormat: "github-run-archive-v1",
    source: run.head_sha, conclusion: run.conclusion, url: run.html_url, verifiedAt: iso(now),
    jobs: jobs.map(job => ({ name: job.name, conclusion: job.conclusion, stepMetadataCount: job.steps?.length ?? null })),
    ...(metadataMissing.length ? { missingStepMetadata: metadataMissing, reviewedWorkflowSha256: contract?.sha256 } : {}),
    annotations, completeLogSha256: hash(logs), completeLogLines: logs.split("\n").length,
    jobLogs: jobs.filter(job => jobLogs[job.id] !== undefined).map(job => ({ id: job.id, name: job.name,
      sha256: hash(jobLogs[job.id]), lines: jobLogs[job.id].split("\n").length })),
    maintenanceKey: receiptFromLogs(logs),
    valid: false, issues: [] };
  if (run.conclusion !== "success") result.issues.push("Workflow failed; inspect its complete logs and annotations.");
  if (annotations.some(item => item.annotation_level === "failure")) result.issues.push("Failure annotations remain.");
  if (jobs.some(job => job.conclusion !== "success" && !(job.name === "publish-security-update" && job.conclusion === "skipped"))) {
    result.issues.push("A required job did not pass.");
  }
  if (run.conclusion === "success") {
    const tested = inspectTests(kind, jobs, jobLogs, contract);
    result.tests = tested.tests;
    result.testEvidence = tested.evidence;
    result.issues.push(...tested.issues);
    const audit = inspectAudits(kind, jobs, jobLogs, contract);
    result.audits = audit.audits;
    result.auditEvidence = audit.evidence;
    result.issues.push(...audit.issues);
    if (kind === "feeds") {
      const match = /\[main ([a-f0-9]+)\] Refresh static feeds/.exec(logs);
      if (!match) throw new Error("Successful refresh lacks an exact publication commit.");
      const commit = runCommand("git", ["rev-parse", match[1]]).trim();
      if (runCommand("git", ["rev-parse", `${commit}^`]).trim() !== run.head_sha) throw new Error("Publication/source mismatch.");
      const publication = await inspectPublication(commit, now, { publicationTime: true });
      try {
        result.publication = { commit, health: publication.health, report: publication.report, horizon: publication.horizon };
        result.issues.push(...publication.issues);
        const production = jobs.flatMap(job => job.steps ?? []).find(step => step.name === "Refresh static feeds with outage recovery");
        const executed = commandEvidence(jobs, jobLogs, { job: "refresh", step: "Refresh static feeds with outage recovery",
          commands: ["npm run generate:static --workspace=@latam-digest/static-feeds"] }, contract);
        const start = production?.conclusion === "success" ? Date.parse(production.started_at) : executed?.startedAt;
        const end = production?.conclusion === "success" ? Date.parse(production.completed_at) + 1_000 : executed?.completedAt;
        if (executed && Number.isFinite(start) && Number.isFinite(end)) {
          result.productionEvidence = { ...executed.proof, startedAt: iso(start), completedAt: iso(end) };
        }
        if (!(Date.parse(publication.health.checkedAt) >= start && Date.parse(publication.health.checkedAt) <= end)) {
          result.issues.push("Health timestamp falls outside production generation.");
        }
        const before = decodeJSON(runCommand("git", ["show", `${run.head_sha}:docs/api/manifest.json`]), "source manifest");
        if (publication.health.mode === "cached") {
          if (publication.manifest.generatedAt !== before.generatedAt) result.issues.push("Cached publication time was renewed.");
        } else if (Date.parse(publication.manifest.generatedAt) < start || Date.parse(publication.manifest.generatedAt) > end) {
          result.issues.push("Publication timestamp falls outside production generation.");
        }
        for (const country of publication.manifest.countries) {
          for (const [key, status] of Object.entries(country.feeds)) {
            if (status.stale) {
              if (status.updatedAt !== before.countries.find(item => item.id === country.id)?.feeds[key]?.updatedAt) {
                result.issues.push("Cached feed timestamp was renewed.");
              }
              const relative = `docs/api/countries/${country.id}/${["top", "latest"].includes(key) ? "" : "category/"}${key}.json`;
              const oldArticles = decodeJSON(runCommand("git", ["show", `${run.head_sha}:${relative}`]), "source cached feed");
              const articles = decodeJSON(await fs.readFile(path.join(publication.directory, relative)), "retained cached feed");
              if (articles.some(article => !oldArticles.some(old => old.id === article.id && old.url === article.url && old.publishedAt === article.publishedAt))) {
                result.issues.push("Cached article identity or original date was changed.");
              }
            } else if (Date.parse(status.updatedAt) < start || Date.parse(status.updatedAt) > end) {
              result.issues.push("Fresh feed timestamp falls outside production generation.");
            }
          }
        }
      } finally { await publication.cleanup(); }
    }
    // The publisher independently verifies the exact immutable artifact hash
    // before writing only package-lock.json; retain its evidence, never bypass it.
    const publisher = jobs.find(job => job.name === "publish-security-update");
    if (publisher?.conclusion === "success") {
      const match = /LOCK_SHA256:\s*([a-f0-9]{64})/.exec(logs);
      if (!match || !/Published the exact security lockfile validated by both jobs|Verified security lockfile already matches main/.test(logs)) {
        result.issues.push("Validated lockfile publication evidence missing.");
      } else result.securityLockSha256 = match[1];
    }
  }
  result.valid = !result.issues.length;
  return result;
}

export async function monitor({ api, ledger, state, now = Date.now(), exercise, outputDirectory }) {
  const evidence = { checkedAt: iso(now), workflows: {}, decisions: {}, problems: [] };
  runCommand("git", ["fetch", "--quiet", "origin", "main"]);
  for (const [kind, config] of Object.entries(WORKFLOWS)) {
    const workflow = await api.request(`actions/workflows/${config.file}`);
    const text = runCommand("git", ["show", `origin/main:.github/workflows/${config.file}`]);
    if (!text.includes(`cron: "${config.cron}"`) || /^\s*timezone:/m.test(text)) throw new Error("Native schedule changed; monitor policy requires review.");
    if (workflow.state !== "active") {
      await api.request(`actions/workflows/${config.file}/enable`, { method: "PUT" });
      evidence.decisions[`${kind}_enable`] = "Re-enabled the existing native workflow.";
    }
    const runs = await api.runs(kind);
    evidence.workflows[kind] = { due: latestDue(kind, now), state: workflow.state, active: runs.filter(run => run.status !== "completed").map(run => run.id) };
    const pending = runs.filter(run => run.status === "completed" && Date.parse(run.created_at) > Date.parse(state.cutoff) &&
      needsInspection(state.inspected[`${run.id}:${run.run_attempt}`])).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    for (const run of pending) {
      const inspected = await inspectRun(api, kind, run, now);
      recordInspection(state, run, inspected);
      recordScheduled(state, kind, { ...run, conclusion: inspected.valid ? "success" : "failure" }, iso(now));
      if (outputDirectory) await fs.writeFile(path.join(outputDirectory, `run-${run.id}-${run.run_attempt}.json`), JSON.stringify(inspected, null, 2));
    }
    for (const receipt of Object.values(state.receipts)) {
      const run = runs.find(item => state.inspected[`${item.id}:${item.run_attempt}`]?.maintenanceKey === receipt.key ||
        item.display_title?.includes(`[${receipt.key}]`)); // Also reconcile the original deployment proof.
      if (run) Object.assign(receipt, { runId: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url });
    }
    const latest = runs[0];
    if (latest?.status === "completed") {
      if (latest.conclusion !== "success") evidence.workflows[kind].failed = latest.id;
      else if (state.inspected[`${latest.id}:${latest.run_attempt}`]?.valid === false) {
        evidence.workflows[kind].verificationFailed = latest.id;
      }
    }
  }
  const commit = runCommand("git", ["log", "-1", "--format=%H", "origin/main", "--", "docs/api"]).trim();
  let publication;
  try {
    publication = await inspectPublication(commit, now);
    if (publication.valid) {
      try { publication.appFacingFilesMatched = await compareAppFacing(publication); }
      catch (error) {
        const latestData = await api.request("commits?path=docs/api&per_page=1");
        if (latestData[0]?.sha !== commit) {
          // Publication won a race with this inspection; inspect it on the
          // completion event/next tick instead of alerting about an old snapshot.
          state.checkedAt = iso(now);
          state.status = "publication_advanced_during_check";
          await ledger.save(state);
          return { attention: false, evidence: { ...evidence, publicationAdvanced: true }, status: state.status };
        }
        throw error;
      }
    }
    evidence.publication = { commit, valid: publication.valid, health: publication.health, report: publication.report,
      issues: publication.issues, expiresAt: iso(publication.expiresAt), appFacingFilesMatched: publication.appFacingFilesMatched };
    if (!publication.valid) evidence.problems.push(`Published data: ${publication.issues.join(" ")}`);
    for (const kind of Object.keys(WORKFLOWS)) {
      evidence.decisions[kind] = await reserveAndDispatch({ api, ledger, state, kind, publication, now, exercise });
      if (evidence.workflows[kind].failed && !evidence.decisions[kind].dispatch) {
        evidence.problems.push(`${WORKFLOWS[kind].name} remains failed; see run ${evidence.workflows[kind].failed}.`);
      } else if (evidence.workflows[kind].verificationFailed && !evidence.decisions[kind].dispatch) {
        const id = evidence.workflows[kind].verificationFailed;
        evidence.problems.push(`${WORKFLOWS[kind].name} verification incomplete; see run ${id}.`);
      }
    }
  } finally { if (publication) await publication.cleanup(); }
  const recovering = Object.values(evidence.workflows).some(workflow => workflow.active.length > 0) || Object.values(state.receipts).some(receipt =>
    ["queued", "in_progress", "pending", "waiting", "requested"].includes(receipt.status) ||
    (["reserved", "dispatched"].includes(receipt.status) && now - Date.parse(receipt.reservedAt) < 3_600_000));
  for (const receipt of Object.values(state.receipts)) {
    if (["reserved", "dispatched", "uncertain_or_rejected"].includes(receipt.status) &&
        now - Date.parse(receipt.reservedAt) >= 3_600_000) evidence.problems.push(`Unconfirmed catch-up ${receipt.key}; GitHub dispatch/access needs review.`);
  }
  state.latest = evidence;
  state.checkedAt = iso(now);
  // Only a new unresolved incident fails the monitor (and generates GitHub's
  // existing failure email). Original failed checks always remain failed.
  const fingerprint = hash(JSON.stringify(evidence.problems.map(problem => problem.replace(/run \d+/g, "run [latest evidence]"))));
  state.activeAlerts ??= [];
  const attention = evidence.problems.length > 0 && !recovering && !state.activeAlerts.includes(fingerprint);
  if (attention) {
    state.alerts[fingerprint] = { firstRaisedAt: iso(now), problems: evidence.problems };
    state.activeAlerts.push(fingerprint);
  }
  if (!evidence.problems.length && !recovering) state.activeAlerts = [];
  // GitHub retains complete logs/artifacts separately. Keep the live ledger
  // below the Contents API size limit without re-inspecting a 30-day run list.
  const oldest = now - 31 * 86_400_000;
  for (const [key, item] of Object.entries(state.inspected)) if (Date.parse(item.createdAt) < oldest) delete state.inspected[key];
  for (const [key, item] of Object.entries(state.receipts)) {
    if (item.status === "completed" && Date.parse(item.reservedAt) < oldest) delete state.receipts[key];
  }
  for (const window of Object.values(state.milestone)) {
    for (const [key, attempt] of Object.entries(window.attempts)) if (Date.parse(attempt.verifiedAt) < oldest) delete window.attempts[key];
    window.history = window.history.slice(-100);
  }
  state.status = recovering ? "recovery_pending" : evidence.problems.length ? "attention_required" : "healthy";
  await ledger.save(state);
  if (outputDirectory) await fs.writeFile(path.join(outputDirectory, "report.json"), JSON.stringify({ ...evidence, status: state.status }, null, 2));
  return { attention, evidence, status: state.status };
}

// This adapter keeps time calculations in the same tested policy module.
function latestDue(kind, now) {
  const decision = recoveryDecision({ kind, now, runs: [], publication: { valid: true, oldestUpdatedAt: now, expiresAt: now + 86_400_000 } });
  return decision.due;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const repository = process.env.GITHUB_REPOSITORY;
    const api = new GitHub({ repository, token: process.env.GH_TOKEN });
    const ledger = new Ledger(api);
    const seed = decodeJSON(await fs.readFile(new URL("../monitor-seed.json", import.meta.url)), "monitor seed");
    const state = await ledger.load(seed);
    const outputDirectory = path.join(root, "watchdog-evidence");
    await fs.mkdir(outputDirectory, { recursive: true });
    const event = decodeJSON(await fs.readFile(process.env.GITHUB_EVENT_PATH), "GitHub event payload");
    const exercise = process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && [true, "true"].includes(event.inputs?.exercise_dispatch)
      ? process.env.GITHUB_RUN_ID : undefined;
    const result = await monitor({ api, ledger, state, exercise, outputDirectory });
    const summary = `Hosted monitoring: ${result.status}; 240-feed validation=${result.evidence.publication?.valid}; all state is on ${stateBranch}.\n`;
    console.log(summary.trim());
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n" +
      result.evidence.problems.join("\n") + "\n");
    if (result.attention) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof SyntaxError ? "Hosted monitor encountered invalid persisted JSON; inspect repository state." :
      error instanceof Error ? error.message.replace(/(?:Bearer\s+\S+|gh[pousr]_[\w]+|github_pat_[\w]+|sk-[\w-]{16,})/g, "[redacted]") : "Hosted monitor requires investigation.");
    // Temporary API outages and rate limits need another server-side tick,
    // not personal authentication or a misleading "healthy" publication.
    process.exitCode = error?.transient ? 0 : 1;
  }
}
