import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { inspectRun, inspectTests } from "../../scripts/hosted-watchdog.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("../fixtures/watchdog-audit-job-logs.json", import.meta.url)));
const full = fixture.jobs.find(job => job.name === "check").id;
const rss = fixture.jobs.find(job => job.name === "static-feeds").id;
const clone = () => structuredClone(fixture);
const inspect = data => inspectTests("backend", data.jobs, data.logs);
const grow = text => text.replace(/(tests|pass) 145/g, "$1 146").replace(/(tests|pass) 161/g, "$1 162");

test("adding passing feed/backend regressions does not create a false workflow failure", async () => {
  const data = clone();
  for (const id of Object.keys(data.logs)) data.logs[id] = grow(data.logs[id]);
  const run = { id: fixture.sourceRun, run_attempt: 1, event: "schedule", conclusion: "success",
    created_at: "2026-10-30T12:50:15Z", head_sha: "891f27ec1992fe1e2dd88b9782c4bb699cadce80" };
  const result = await inspectRun({ pages: async endpoint => endpoint.includes("/jobs") ? data.jobs : [],
    runLogs: async () => data.logs }, "backend", run, Date.now());
  assert.equal(result.valid, true);
  assert.deepEqual(result.tests, { check: 162, "static-feeds": 146 });
  assert.deepEqual(result.audits, { check: 0, "static-feeds": 0 });
});

test("retained baselines are required from each job, even if another job has more tests", () => {
  for (const [id, original, reduced] of [[full, 161, 160], [rss, 145, 144]]) {
    const data = clone();
    data.logs[id] = data.logs[id].replace(new RegExp(`(tests|pass) ${original}`, "g"), `$1 ${reduced}`);
    const result = inspect(data);
    assert.equal(result.issues.length, 1);
    assert.equal(result.tests[id === full ? "check" : "static-feeds"], undefined);
  }
});

test("controller test totals or unscoped log output cannot replace a missing backend test command", () => {
  const data = clone();
  data.logs[full] = data.logs[full].replaceAll("npm test", "npm run test:watchdog");
  assert.equal(inspect(data).tests.check, undefined);
});

test("missing, failed, skipped and cancelled test steps fail despite a passing log", () => {
  for (const conclusion of [undefined, "failure", "skipped", "cancelled"]) {
    const data = clone(); data.jobs.find(job => job.id === rss).steps.find(step => step.name.startsWith("Run npm test")).conclusion = conclusion;
    assert.equal(inspect(data).tests["static-feeds"], undefined);
  }
});

test("failed, skipped, cancelled, todo or inconsistent summaries cannot be accepted", () => {
  for (const field of ["fail", "skipped", "cancelled", "todo"]) {
    const data = clone(); data.logs[rss] = grow(data.logs[rss]).replace(`${field} 0`, `${field} 1`);
    assert.equal(inspect(data).tests["static-feeds"], undefined);
  }
  const data = clone(); data.logs[rss] = data.logs[rss].replace("tests 145", "tests 146");
  assert.equal(inspect(data).tests["static-feeds"], undefined);
});

test("duplicate or missing summary fields remain ambiguous evidence", () => {
  for (const change of [text => text.replace("ℹ pass 145", "ℹ pass 145\nℹ pass 145"),
    text => text.replace("ℹ fail 0", "")]) {
    const data = clone(); data.logs[rss] = change(data.logs[rss]);
    assert.equal(inspect(data).tests["static-feeds"], undefined);
  }
});

test("another job's isolation proof cannot replace the successful isolated check command", () => {
  const data = clone(); const proof = "Static feed dependency isolation verified; optional backend packages are absent.";
  data.logs[full] += `\n${proof}\n`; data.logs[rss] = data.logs[rss].replace(proof, "");
  assert.deepEqual(inspect(data).issues, ["static-feeds: dependency isolation evidence is incomplete."]);
});

const feedCommands = ["npm run check --workspace=@latam-digest/static-feeds", "npm test --workspace=@latam-digest/static-feeds",
  "npm audit --omit=dev --workspace=@latam-digest/static-feeds --include-workspace-root=false"];
const feedHeader = `##[group]Run ${feedCommands[0]}\n${feedCommands.join("\n")}\n##[endgroup]\n`;
const feedSummary = "# tests 146\n# pass 146\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
const proof = "Static feed dependency isolation verified; optional backend packages are absent.\n";
const feedJobs = [{ id: 1, name: "refresh", conclusion: "success", steps: [{ name: "Check pipeline", number: 6, conclusion: "success" }] }];

test("bundled feed pipeline permits test growth and recognizes TAP, ANSI, BOM and CRLF", () => {
  const raw = "\uFEFF" + (feedHeader + proof + feedSummary + "found 0 vulnerabilities\n")
    .replaceAll("#", "\x1b[36m#").replaceAll("\n", "\x1b[0m\r\n");
  const result = inspectTests("feeds", feedJobs, { 1: raw });
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.tests, { refresh: 146 });
});

test("echoed summary in a header or following step cannot stand in for executed tests", () => {
  for (const raw of [feedHeader.replace("##[endgroup]", feedSummary + "##[endgroup]") + proof,
    feedHeader + proof + "##[group]Run echo summary\necho summary\n##[endgroup]\n" + feedSummary]) {
    assert.equal(inspectTests("feeds", feedJobs, { 1: raw }).tests.refresh, undefined);
  }
});
