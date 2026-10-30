import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { inspectRun, inspectAudits, needsInspection, recordInspection, INSPECTION_VERSION, GitHub } from "../../scripts/hosted-watchdog.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("../fixtures/watchdog-audit-job-logs.json", import.meta.url)));
const run = { id: fixture.sourceRun, run_attempt: 1, event: "workflow_dispatch", conclusion: "success",
  created_at: "2026-10-30T12:50:15Z", head_sha: "891f27ec1992fe1e2dd88b9782c4bb699cadce80" };
const clone = () => structuredClone(fixture);
const check = fixture.jobs.find(job => job.name === "check");
const isolated = fixture.jobs.find(job => job.name === "static-feeds");
const scoped = "npm audit --omit=dev --workspace=@latam-digest/static-feeds --include-workspace-root=false";
const block = (commands, output) => `\uFEFF2026-10-30T12:00:00.000Z ##[group]Run ${commands[0]}\n` +
  commands.map(command => `2026-10-30T12:00:00.001Z \x1b[36;1m${command}\x1b[0m\n`).join("") +
  `2026-10-30T12:00:00.002Z ##[endgroup]\n2026-10-30T12:00:00.003Z ${output}\n`;

test("incident 41087545388: original backend logs verify even when CLI step labels are UNKNOWN STEP", async () => {
  const rendered = Object.entries(fixture.logs).map(([id, raw]) => raw.split("\n").map(line =>
    `${fixture.jobs.find(job => String(job.id) === id).name}\tUNKNOWN STEP\t${line}`).join("\n")).join("\n");
  // Reproduce the old false alarm without running another known-failing workflow.
  for (const name of ["check", "static-feeds"]) {
    const old = rendered.split("\n").filter(line => {
      const [job, step] = line.split("\t"); return job === name && step.includes("npm audit");
    }).join("\n");
    assert.equal(old.includes("found 0 vulnerabilities"), false);
  }
  const requested = [];
  const api = { pages: async endpoint => endpoint.includes("/jobs") ? fixture.jobs : [],
    jobLogs: async id => { requested.push(id); assert.ok(fixture.logs[id]); return fixture.logs[id]; } };
  const result = await inspectRun(api, "backend", run, Date.now());
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.audits, { check: 0, "static-feeds": 0 });
  assert.equal(result.completeLogFormat, "github-job-logs-v1");
  assert.equal(result.inspectionVersion, INSPECTION_VERSION);
  assert.deepEqual(requested.sort(), [check.id, isolated.id].sort()); // Skipped publisher has no logs.
  assert.match(result.auditEvidence.check.jobLogSha256, /^[a-f0-9]{64}$/);
});

test("original audit excerpts handle BOM, ANSI color and CRLF without display-name parsing", () => {
  const data = clone();
  for (const id of Object.keys(data.logs)) data.logs[id] = "\uFEFF" + data.logs[id].replaceAll("\n", "\r\n");
  assert.deepEqual(inspectAudits("backend", data.jobs, data.logs).issues, []);
});

test("a clean install cannot stand in for a missing production audit", () => {
  const data = clone(); data.logs[check.id] = block(["npm ci --ignore-scripts"], "found 0 vulnerabilities");
  const result = inspectAudits("backend", data.jobs, data.logs);
  assert.equal(result.audits.check, undefined);
  assert.deepEqual(result.issues, ["check: missing clean production audit evidence."]);
});

test("failed, skipped or missing audit steps stay invalid even with a zero-vulnerability log", () => {
  for (const conclusion of ["failure", "skipped", "cancelled", undefined]) {
    const data = clone(); data.jobs.find(job => job.name === "check").steps[0].conclusion = conclusion;
    assert.equal(inspectAudits("backend", data.jobs, data.logs).audits.check, undefined);
  }
});

test("one job's clean audit cannot certify the other job", () => {
  const data = clone(); data.logs[isolated.id] = data.logs[check.id];
  assert.deepEqual(inspectAudits("backend", data.jobs, data.logs).audits, { check: 0 });
});

test("vulnerable results and success text echoed in a command header fail closed", () => {
  for (const text of [block(["npm audit --omit=dev"], "1 high severity vulnerability"),
    block(["npm audit --omit=dev", "found 0 vulnerabilities"], "audit output unavailable")]) {
    const data = clone(); data.logs[check.id] = text;
    assert.equal(inspectAudits("backend", data.jobs, data.logs).audits.check, undefined);
  }
});

test("feed pipeline requires its successful isolated production audit after the test commands", () => {
  const jobs = [{ id: 1, name: "refresh", conclusion: "success", steps: [{ name: "Check pipeline", number: 6, conclusion: "success" }] }];
  const commands = ["npm run check --workspace=@latam-digest/static-feeds", "npm test --workspace=@latam-digest/static-feeds", scoped];
  assert.deepEqual(inspectAudits("feeds", jobs, { 1: block(commands, "found 0 vulnerabilities") }).audits, { refresh: 0 });
  for (const modified of [commands.slice(0, 2), [...commands.slice(0, 2), "npm audit --omit=dev"]]) {
    assert.equal(inspectAudits("feeds", jobs, { 1: block(modified, "found 0 vulnerabilities") }).audits.refresh, undefined);
  }
});

test("ambiguous duplicated audit blocks are not accepted as proof", () => {
  const data = clone(); data.logs[check.id] += data.logs[check.id];
  assert.equal(inspectAudits("backend", data.jobs, data.logs).audits.check, undefined);
});

test("only legacy invalid inspections are rechecked after the parser upgrade", () => {
  assert.equal(needsInspection(undefined), true);
  assert.equal(needsInspection({ valid: false }), true);
  assert.equal(needsInspection({ valid: false, inspectionVersion: 1 }), true);
  assert.equal(needsInspection({ valid: true }), false);
  assert.equal(needsInspection({ valid: false, inspectionVersion: INSPECTION_VERSION }), false);
});

test("successful reinspection replaces the false result while preserving incident and milestone history", async () => {
  const prior = { valid: false, issues: ["check: missing clean production audit evidence."], verifiedAt: "2026-10-30T16:11:26Z" };
  const state = { inspected: { [`${run.id}:1`]: prior }, receipts: { old: { status: "completed" } },
    alerts: { original: { problems: ["Backend Checks remains failed"] } }, milestone: { backend: { runIds: [1] } } };
  const untouched = structuredClone({ receipts: state.receipts, alerts: state.alerts, milestone: state.milestone });
  const api = { pages: async endpoint => endpoint.includes("/jobs") ? fixture.jobs : [], jobLogs: async id => fixture.logs[id] };
  recordInspection(state, run, await inspectRun(api, "backend", run, Date.now()));
  const updated = state.inspected[`${run.id}:1`];
  assert.equal(updated.valid, true);
  assert.deepEqual(updated.verificationHistory[0].issues, prior.issues);
  assert.equal(updated.verificationHistory[0].valid, false);
  assert.equal(needsInspection(updated), false);
  assert.deepEqual({ receipts: state.receipts, alerts: state.alerts, milestone: state.milestone }, untouched);
});

test("original job-log reads reject invalid job identities before invoking GitHub", async () => {
  const api = new GitHub({ repository: "apovolotski/LatamDigest", token: "test-only" });
  for (const id of [0, -1, "123", NaN]) await assert.rejects(api.jobLogs(id), /Invalid job log identity/);
});
