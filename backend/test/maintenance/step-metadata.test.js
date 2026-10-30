import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { inspectRun, inspectAudits, inspectTests, workflowContract, commandEvidence } from "../../scripts/hosted-watchdog.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("../fixtures/watchdog-empty-step-metadata.json", import.meta.url)));
const source = {};
for (const [kind, name] of [["backend", "backend-checks"], ["feeds", "refresh-static-feeds"]]) {
  source[kind] = await fs.readFile(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), "utf8").catch(() =>
    fs.readFile(new URL(`../../../../.github/workflows/${name}.yml`, import.meta.url), "utf8"));
}
const contract = workflowContract("backend", source.backend);
const clone = () => structuredClone(fixture);
const check = fixture.jobs.find(job => job.name === "check");

test("reviewed workflow contracts remain blocking; edits require explicit contract review", () => {
  for (const kind of ["backend", "feeds"]) {
    assert.ok(workflowContract(kind, source[kind]));
    assert.equal(workflowContract(kind, source[kind] + "\n# source changed\n"), undefined);
    assert.equal(workflowContract(kind, source[kind].replace("npm audit --omit=dev", "npm audit --omit=dev || true")), undefined);
    assert.equal(workflowContract(kind, source[kind].replace("runs-on: ubuntu-latest", "runs-on: ubuntu-latest\n    continue-on-error: true")), undefined);
  }
});

test("incident 41105098855: original audit/test proof verifies when GitHub returns empty step arrays", async () => {
  assert.equal(fixture.jobs.every(job => job.steps.length === 0), true);
  const run = { id: fixture.sourceRun, run_attempt: 1, event: "push", conclusion: "success",
    created_at: "2026-10-30T18:12:45Z", head_sha: fixture.sourceCommit };
  const result = await inspectRun({ pages: async endpoint => endpoint.includes("/jobs") ? fixture.jobs : [],
    runLogs: async () => fixture.logs, workflowSource: async () => source.backend }, "backend", run, Date.now());
  assert.equal(result.valid, true);
  assert.deepEqual(result.tests, { check: 161, "static-feeds": 145 });
  assert.deepEqual(result.audits, { check: 0, "static-feeds": 0 });
  assert.deepEqual(result.missingStepMetadata, ["check", "static-feeds"]);
  assert.equal(result.auditEvidence.check.source, "original-log-and-reviewed-blocking-workflow");
  assert.equal(result.auditEvidence.check.workflowSha256, contract.sha256);
  assert.equal(result.auditEvidence.check.stepNumber, undefined);
});

test("empty metadata without the exact reviewed workflow does not verify", () => {
  for (const proof of [undefined, workflowContract("backend", source.backend + "\n"), workflowContract("feeds", source.feeds)]) {
    assert.equal(inspectAudits("backend", fixture.jobs, fixture.logs, proof).audits.check, undefined);
    assert.equal(inspectTests("backend", fixture.jobs, fixture.logs, proof).tests.check, undefined);
  }
});

test("fallback cannot override explicit failed, skipped, cancelled, missing or ambiguous steps", () => {
  for (const steps of [
    [{ name: "Run npm audit --omit=dev", conclusion: "failure" }],
    [{ name: "Run npm audit --omit=dev", conclusion: "skipped" }],
    [{ name: "Run npm audit --omit=dev", conclusion: "cancelled" }],
    [{ name: "another step", conclusion: "success" }],
    Array.from({ length: 2 }, () => ({ name: "Run npm audit --omit=dev", conclusion: "success" }))
  ]) {
    const data = clone(); data.jobs.find(job => job.id === check.id).steps = steps;
    assert.equal(inspectAudits("backend", data.jobs, data.logs, contract).audits.check, undefined);
  }
});

test("fallback still rejects missing, vulnerable, duplicated or wrong-job audit results", () => {
  for (const mutate of [
    logs => { logs[check.id] = logs[check.id].replace("found 0 vulnerabilities", "1 high severity vulnerability"); },
    logs => { logs[check.id] = logs[check.id].replaceAll("npm audit --omit=dev", "npm ci"); },
    logs => { logs[check.id] += logs[check.id]; },
    logs => { logs[check.id] = Object.values(logs)[1]; }
  ]) {
    const data = clone(); mutate(data.logs);
    assert.equal(inspectAudits("backend", data.jobs, data.logs, contract).audits.check, undefined);
  }
});

test("fallback requires the actual fail-fast shell and rejects command or job failure", () => {
  for (const mutate of [
    data => { data.logs[check.id] = data.logs[check.id].replaceAll("shell: /usr/bin/bash -e {0}", "shell: /usr/bin/bash {0}"); },
    data => { data.logs[check.id] += "\n##[error]Process completed with exit code 1.\n"; },
    data => { data.jobs.find(job => job.id === check.id).conclusion = "failure"; }
  ]) {
    const data = clone(); mutate(data);
    assert.equal(inspectAudits("backend", data.jobs, data.logs, contract).audits.check, undefined);
  }
});

test("feed production timestamps come from the exact executed command when step metadata is empty", () => {
  const command = "npm run generate:static --workspace=@latam-digest/static-feeds";
  const jobs = [{ id: 1, name: "refresh", conclusion: "success", steps: [] }];
  const raw = `2026-10-30T16:36:00.000Z ##[group]Run ${command}\n${command}\nshell: /usr/bin/bash -e {0}\n##[endgroup]\n` +
    "2026-10-30T16:38:00.000Z ##[group]Run npm run check:coverage --workspace=@latam-digest/static-feeds\n";
  const result = commandEvidence(jobs, { 1: raw }, { job: "refresh", step: "Refresh static feeds with outage recovery", commands: [command] }, workflowContract("feeds", source.feeds));
  assert.equal(result.startedAt, Date.parse("2026-10-30T16:36:00Z"));
  assert.equal(result.completedAt, Date.parse("2026-10-30T16:38:00Z"));
  assert.equal(result.proof.source, "original-log-and-reviewed-blocking-workflow");
});
