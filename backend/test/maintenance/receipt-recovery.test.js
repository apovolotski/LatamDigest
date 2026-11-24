import test from "node:test";
import assert from "node:assert/strict";
import { GitHub, reserveAndDispatch, recordMonitorOutcome, needsInspection, recordInspection } from "../../scripts/hosted-watchdog.mjs";
import { reconcileReceiptRuns, supersedeRecoveredReceipts, recoveryDecision } from "../../src/watchdogPolicy.js";

const HOUR = 3_600_000, now = Date.parse("2026-11-24T22:25:24.177Z");
const repository = "apovolotski/LatamDigest", source = "5d37e20607fc198cd11661be90f4da4743cde47c";
const commit = "082ffedfc1a2d53f55c27c073681106fbb55b2fa";
function fixture(kind = "feeds") {
  const key = `${kind}-20261124181700000`;
  const receipt = { key, kind, reason: "late_schedule", due: "2026-11-24T18:17:00Z",
    reservedAt: "2026-11-24T20:53:00.548Z", status: "uncertain_or_rejected" };
  const run = { id: 45500117017, run_attempt: 1, event: "schedule", status: "completed", conclusion: "success",
    head_branch: "main", head_repository: { full_name: repository }, head_sha: source,
    created_at: "2026-11-24T22:21:12Z", html_url: `https://github.com/${repository}/actions/runs/45500117017` };
  const inspected = { id: run.id, attempt: 1, event: run.event, source, conclusion: "success", valid: true,
    issues: [], verifiedAt: new Date(now).toISOString(), publicationCommit: commit };
  const state = { repository, receipts: { [key]: receipt }, inspected: { [`${run.id}:1`]: inspected },
    alerts: { original: { problems: [`Unconfirmed catch-up ${key}`] } }, activeAlerts: ["original"],
    milestone: { feeds: { runIds: [run.id], attempts: {}, history: [] } } };
  const publication = { valid: true, commit, appFacingFilesMatched: 243,
    oldestUpdatedAt: Date.parse("2026-11-24T22:21:38.576Z"), expiresAt: now + 24 * HOUR };
  const evidence = () => ({ workflows: { feeds: { active: [] }, backend: { active: [] } }, problems: [] });
  return { state, receipt, run, inspected, kind, publication, now, runs: [run], evidence };
}

test("Nov24 uncertain catch-up resolves only after the verified native publication, without inventing a bot run", async () => {
  const f = fixture(); const historical = structuredClone(f.state.alerts), milestones = structuredClone(f.state.milestone);
  assert.equal(recordMonitorOutcome(structuredClone(f.state), f.evidence(), now), true); // Reproduce the old false alert.
  const resolved = supersedeRecoveredReceipts(f);
  assert.equal(resolved.length, 1);
  assert.equal(f.receipt.status, "superseded");
  assert.equal(f.receipt.runId, undefined);
  assert.equal(f.receipt.resolution.previousStatus, "uncertain_or_rejected");
  assert.equal(f.receipt.resolution.dispatchOutcome, "unconfirmed");
  assert.equal(f.receipt.resolution.runId, f.run.id);
  assert.equal(f.receipt.resolution.publication, commit);
  assert.equal(recordMonitorOutcome(f.state, f.evidence(), now), false);
  assert.equal(f.state.status, "healthy"); assert.deepEqual(f.state.activeAlerts, []);
  assert.deepEqual(f.state.alerts, historical); assert.deepEqual(f.state.milestone, milestones);
  assert.deepEqual(supersedeRecoveredReceipts(f), []);
  let posts = 0;
  const api = { runs: async () => f.runs, request: async () => posts++ };
  await reserveAndDispatch({ ...f, api, ledger: { save: async () => {} } });
  assert.equal(posts, 0);
});

test("the same lifecycle resolves reserved, accepted and uncertain backend requests using verified replacements", () => {
  for (const status of ["reserved", "dispatched", "uncertain_or_rejected"]) {
    for (const event of ["schedule", "workflow_dispatch", "push"]) {
      const f = fixture("backend");f.receipt.status = status;f.run.event = f.inspected.event = event;
      assert.equal(supersedeRecoveredReceipts(f).length, 1);
      assert.equal(f.receipt.resolution.previousStatus, status);
      assert.equal(f.receipt.resolution.publication, undefined);
    }
  }
});

test("green but unverified, wrong-source, wrong-attempt and contradictory replacement runs never clear a receipt", () => {
  for (const change of [f => { f.state.inspected = {}; }, f => { f.inspected.valid = false; },
    f => { f.inspected.source = "other"; }, f => { f.inspected.attempt = 2; },
    f => { f.inspected.id++; }, f => { f.inspected.event = "push"; },
    f => { f.inspected.issues = ["audit missing"]; }, f => { f.inspected.conclusion = "failure"; },
    f => { f.run.conclusion = "failure"; }, f => { f.run.status = "in_progress"; }]) {
    const f = fixture();change(f);assert.deepEqual(supersedeRecoveredReceipts(f), []);
    assert.equal(f.receipt.status, "uncertain_or_rejected");
  }
});

test("publication identity, app-facing bytes, freshness and expiry remain required for feed recovery", () => {
  for (const change of [f => { f.publication.valid = false; }, f => { f.publication.appFacingFilesMatched = 242; },
    f => { f.publication.commit = "different"; }, f => { delete f.inspected.publicationCommit; },
    f => { f.publication.oldestUpdatedAt = now - 8 * HOUR; },
    f => { f.publication.oldestUpdatedAt = Date.parse(f.receipt.reservedAt) - 1; },
    f => { f.publication.oldestUpdatedAt = now + 1; }, f => { f.publication.expiresAt = now + HOUR; }]) {
    const f = fixture();change(f);assert.deepEqual(supersedeRecoveredReceipts(f), []);
  }
});

test("older, future, fork and non-main replacements cannot resolve recovery", () => {
  for (const kind of ["feeds", "backend"]) for (const change of [
    f => { f.run.created_at = f.receipt.reservedAt; }, f => { f.run.created_at = "bad-date"; },
    f => { f.run.created_at = new Date(now + 1).toISOString(); },
    f => { f.run.head_repository.full_name = "outside/fork"; }, f => { f.run.head_branch = "feature"; },
    f => { f.run.event = "pull_request"; }]) {
    const f = fixture(kind);change(f);assert.deepEqual(supersedeRecoveredReceipts(f), []);
  }
  const f = fixture("backend"); f.receipt.due = new Date(now + HOUR).toISOString();
  assert.deepEqual(supersedeRecoveredReceipts(f), []);
});

test("a newer failed or active run prevents a previous success from masking current trouble", () => {
  for (const state of [{status:"completed",conclusion:"failure"},{status:"queued",conclusion:null}]) {
    const f=fixture();f.runs.push({...f.run,id:99,created_at:"2026-11-24T22:24:00Z",...state});
    assert.deepEqual(supersedeRecoveredReceipts(f), []);
  }
});

test("explicit dispatch exercises, known access rejection, and already linked runs are not superseded", () => {
  for (const change of [f => { f.receipt.reason="transport_exercise"; }, f => { f.receipt.key="probe-1-feeds"; },
    f => { f.receipt.dispatchError={transient:false,httpStatus:403}; }, f => { f.receipt.runId=9; },
    f => { f.receipt.kind="backend"; }]) {
    const f=fixture();change(f);assert.deepEqual(supersedeRecoveredReceipts(f), []);
  }
});

test("exact receipt confirmation is workflow-scoped and takes precedence over a replacement", () => {
  const f=fixture(); f.run.event="workflow_dispatch"; f.inspected.maintenanceKey=f.receipt.key;
  reconcileReceiptRuns(f.state,"backend",f.runs);assert.equal(f.receipt.runId,undefined);
  reconcileReceiptRuns(f.state,"feeds",f.runs);
  assert.equal(f.receipt.runId,f.run.id);assert.equal(f.receipt.status,"completed");
  assert.deepEqual(supersedeRecoveredReceipts(f),[]);
});

test("ambiguous or untrusted exact receipt matches cannot select an arbitrary dispatch", () => {
  for (const change of [f => { f.runs.push({...f.run,id:99}); f.state.inspected['99:1']={maintenanceKey:f.receipt.key}; },
    f => { f.run.event="schedule"; }, f => { f.run.head_branch="feature"; },
    f => { f.run.created_at="2026-11-24T19:00:00Z"; }]) {
    const f=fixture();f.run.event="workflow_dispatch";f.inspected.maintenanceKey=f.receipt.key;change(f);
    reconcileReceiptRuns(f.state,"feeds",f.runs);assert.equal(f.receipt.runId,undefined);
  }
});

test("late exact confirmation preserves a superseded resolution and does not reopen its alert", () => {
  const f=fixture();supersedeRecoveredReceipts(f);const resolution=structuredClone(f.receipt.resolution);
  f.run.event="workflow_dispatch";f.run.conclusion="failure";f.inspected.maintenanceKey=f.receipt.key;
  reconcileReceiptRuns(f.state,"feeds",f.runs);
  assert.equal(f.receipt.status,"superseded");assert.deepEqual(f.receipt.resolution,resolution);
  assert.equal(f.receipt.lateConfirmation.conclusion,"failure");
});

test("superseded receipts still enforce once-per-key and the original cooldown", () => {
  const f=fixture();supersedeRecoveredReceipts(f);
  const stale={...f.publication,oldestUpdatedAt:now-8*HOUR};
  assert.equal(recoveryDecision({...f,publication:stale,receipts:f.state.receipts}).reason,"already_reserved");
  assert.equal(recoveryDecision({...f,now:now+4*HOUR,publication:stale,receipts:f.state.receipts}).reason,"cooldown");
});

test("unrecovered uncertainty still alerts once, and a separate publication defect is never hidden", () => {
  const f=fixture();assert.equal(recordMonitorOutcome(f.state,f.evidence(),now),true);
  assert.equal(recordMonitorOutcome(f.state,f.evidence(),now),false);
  assert.equal(f.state.status,"attention_required");
  supersedeRecoveredReceipts(f);const e=f.evidence();e.problems.push("Published data: expired article.");
  assert.equal(recordMonitorOutcome(f.state,e,now),true);assert.equal(f.state.status,"attention_required");
});

test("HTTP 500 dispatch is never retried; only sanitized error classification is retained", async () => {
  const f=fixture();f.state.receipts={};let calls=0;
  const api=new GitHub({repository,token:"test-private-value",transport:async()=>{calls++;return {ok:false,status:500};}});
  api.runs=async()=>[];
  const options={...f,api,ledger:{save:async()=>{}},publication:{...f.publication,oldestUpdatedAt:now-8*HOUR}};
  await assert.rejects(reserveAndDispatch(options),/HTTP 500/);assert.equal(calls,1);
  const receipt=Object.values(f.state.receipts)[0];assert.deepEqual(receipt.dispatchError,{transient:true,httpStatus:500});
  assert.equal(receipt.dispatchOutcome,"unconfirmed");
  await reserveAndDispatch(options);assert.equal(calls,1);
  assert(!JSON.stringify(f.state).includes("test-private-value"));
});

test("legacy feed evidence gains a durable publication identity without resetting its history", () => {
  const previous={valid:true,tests:{refresh:319},inspectionVersion:5,verifiedAt:"2026-11-24T22:25:00Z"};
  assert.equal(needsInspection(previous),true);
  const f=fixture();f.state.inspected[`${f.run.id}:1`]=previous;
  const next={...f.inspected,tests:{refresh:319},inspectionVersion:6,publication:{commit}};
  recordInspection(f.state,f.run,next);
  const stored=f.state.inspected[`${f.run.id}:1`];assert.equal(stored.publication,undefined);
  assert.equal(stored.publicationCommit,commit);assert.equal(stored.verificationHistory[0].valid,true);
  assert.equal(needsInspection(stored),false);
});

test("monitor outcomes retain old receipts, inspections and all milestone history beyond artifact retention", () => {
  const f=fixture();f.state.receipts.old={kind:"feeds",key:"old",status:"completed",reservedAt:"2025-01-01T00:00:00Z"};
  f.state.inspected.old={createdAt:"2025-01-01T00:00:00Z",valid:true};
  f.state.milestone.feeds.history=Array.from({length:105},(_,i)=>({runIds:[i]}));
  f.state.milestone.feeds.attempts.old={verifiedAt:"2025-01-01T00:00:00Z"};
  const retained=structuredClone({inspected:f.state.inspected,milestone:f.state.milestone,old:f.state.receipts.old});
  recordMonitorOutcome(f.state,f.evidence(),now);
  assert.deepEqual({inspected:f.state.inspected,milestone:f.state.milestone,old:f.state.receipts.old},retained);
});
