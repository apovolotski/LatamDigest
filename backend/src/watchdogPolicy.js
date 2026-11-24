import { isUnavailableFeed } from "./feedFreshness.js";

const HOUR = 3_600_000;
export const WORKFLOWS = {
  feeds: { file: "refresh-static-feeds.yml", name: "Refresh Static Feeds", cron: "17 */6 * * *", cooldown: 6 * HOUR },
  backend: { file: "backend-checks.yml", name: "Backend Checks", cron: "43 10 * * *", cooldown: 24 * HOUR }
};
export const activeRun = run => run.status !== "completed";
export const mainRun = (run, repository) => run.head_branch === "main" &&
  run.event !== "pull_request" && run.head_repository?.full_name === repository;

export const unconfirmedReceipt = receipt =>
  ["reserved", "dispatched", "uncertain_or_rejected"].includes(receipt.status);

export function reconcileReceiptRuns(state, kind, runs) {
  for (const receipt of Object.values(state.receipts)) {
    if (receipt.kind !== kind) continue;
    const matches = runs.filter(run => mainRun(run, state.repository) && run.event === "workflow_dispatch" &&
      Date.parse(run.created_at) >= Date.parse(receipt.reservedAt) &&
      (state.inspected[`${run.id}:${run.run_attempt}`]?.maintenanceKey === receipt.key ||
        run.display_title?.includes(`[${receipt.key}]`)));
    // Do not arbitrarily select one identity if upstream metadata is ambiguous.
    if (matches.length !== 1) continue;
    const run = matches[0];
    const confirmation = { runId: run.id, attempt: run.run_attempt, status: run.status,
      conclusion: run.conclusion, url: run.html_url };
    if (receipt.status === "superseded") receipt.lateConfirmation = confirmation;
    else Object.assign(receipt, confirmation);
  }
}

export function supersedeRecoveredReceipts({ state, kind, runs, publication, now }) {
  const resolutions = [];
  const trusted = runs.filter(run => mainRun(run, state.repository));
  // An actual active run or a more recent failure must remain visible.
  if (trusted.some(activeRun)) return resolutions;
  const run = [...trusted].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const inspected = run && state.inspected[`${run.id}:${run.run_attempt}`];
  if (!run || run.status !== "completed" || run.conclusion !== "success" || inspected?.valid !== true ||
      inspected.id !== run.id || inspected.attempt !== run.run_attempt || inspected.source !== run.head_sha ||
      inspected.event !== run.event || inspected.conclusion !== "success" || inspected.issues?.length !== 0) return resolutions;
  for (const receipt of Object.values(state.receipts)) {
    if (receipt.kind !== kind || !unconfirmedReceipt(receipt) || receipt.runId ||
        typeof receipt.key !== "string" || receipt.dispatchError?.transient === false ||
        receipt.reason === "transport_exercise" || receipt.key.startsWith("probe-")) continue;
    const reserved = Date.parse(receipt.reservedAt), created = Date.parse(run.created_at);
    if (!Number.isFinite(reserved) || !Number.isFinite(created) || created <= reserved || created > now) continue;
    if (kind === "feeds") {
      // A green run alone does not prove recovery. It must have published the
      // current, byte-matched, fresh and non-expiring app-facing publication.
      if (!publication?.valid || publication.appFacingFilesMatched !== 243 ||
          !inspected.publicationCommit || inspected.publicationCommit !== publication.commit ||
          !(publication.oldestUpdatedAt >= reserved && publication.oldestUpdatedAt <= now) ||
          !(now - publication.oldestUpdatedAt < 7.5 * HOUR) || !(publication.expiresAt > now + HOUR)) continue;
    } else if (kind === "backend") {
      if (!Number.isFinite(Date.parse(receipt.due)) || created < Date.parse(receipt.due)) continue;
    } else continue;
    receipt.resolution = { reason: "verified_replacement", resolvedAt: new Date(now).toISOString(),
      previousStatus: receipt.status, dispatchOutcome: "unconfirmed", runId: run.id,
      attempt: run.run_attempt, event: run.event, source: run.head_sha, verifiedAt: inspected.verifiedAt,
      ...(kind === "feeds" ? { publication: publication.commit } : {}) };
    receipt.status = "superseded";
    resolutions.push({ key: receipt.key, kind, ...receipt.resolution });
  }
  return resolutions;
}

export function latestSlot(kind, now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime()) || !WORKFLOWS[kind]) throw new Error("Invalid monitor clock or workflow.");
  date.setUTCSeconds(0, 0);
  if (kind === "feeds") {
    date.setUTCMinutes(17);
    date.setUTCHours(Math.floor(date.getUTCHours() / 6) * 6);
    if (date.getTime() > now) date.setUTCHours(date.getUTCHours() - 6);
  } else {
    date.setUTCHours(10, 43);
    if (date.getTime() > now) date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString();
}

// Pure decision logic: the caller must re-read runs and reserve the receipt
// durably before issuing the single, non-retried dispatch request.
export function recoveryDecision({ kind, now, runs, publication, receipts = {}, exercise }) {
  const config = WORKFLOWS[kind];
  if (!config || !Number.isFinite(now)) throw new Error("Invalid recovery inputs.");
  if (runs.some(activeRun)) return { dispatch: false, reason: "run_active" };
  const due = latestSlot(kind, now);
  const last = [...runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  let reason;
  let key;
  if (exercise) {
    if (!/^[0-9]+$/.test(String(exercise))) throw new Error("Invalid dispatch exercise identifier.");
    reason = "transport_exercise";
    key = `probe-${exercise}-${kind}`;
  } else if (last && last.conclusion !== "success") {
    reason = "failed_run";
    key = `${kind}-failed-${last.id}-${last.run_attempt}`;
  } else if (kind === "feeds" && (!publication?.valid || publication.expiresAt <= now + HOUR)) {
    reason = "publication_invalid_or_expiring";
    key = `feeds-publication-${publication?.commit ?? "missing"}`;
  } else {
    if (now - Date.parse(due) < 90 * 60_000) return { dispatch: false, reason: "schedule_grace", due };
    if (kind === "backend") {
      if (runs.some(run => run.conclusion === "success" && Date.parse(run.created_at) >= Date.parse(due))) {
        return { dispatch: false, reason: "daily_check_covered", due };
      }
    } else if (publication && now - publication.oldestUpdatedAt < 7.5 * HOUR) {
      return { dispatch: false, reason: "publication_current", due };
    }
    reason = "late_schedule";
    key = `${kind}-${due.replace(/[^0-9]/g, "")}`;
  }
  if (receipts[key]) return { dispatch: false, reason: "already_reserved", key, due };
  if (!exercise && Object.values(receipts).some(receipt => receipt.kind === kind &&
    now - Date.parse(receipt.reservedAt) < config.cooldown)) {
    return { dispatch: false, reason: "cooldown", due };
  }
  return { dispatch: true, key, kind, due, reason };
}

export function recordScheduled(state, kind, run, verifiedAt) {
  if (run.event !== "schedule" || Date.parse(run.created_at) <= Date.parse(state.cutoff)) return;
  const window = state.milestone[kind];
  const identity = `${run.id}:${run.run_attempt}`;
  if (window.attempts[identity]) return;
  window.attempts[identity] = { conclusion: run.conclusion, verifiedAt };
  if (run.conclusion !== "success") {
    window.history.push({ endedAt: verifiedAt, runIds: window.runIds });
    window.runIds = [];
    delete window.completedAt;
  } else if (!window.runIds.includes(run.id)) {
    if (window.runIds.length < 4) window.runIds.push(run.id);
    if (window.runIds.length >= 4) window.completedAt ??= verifiedAt;
  }
  // Completion is a milestone, never a reason to stop the hosted controller.
}

export function validateHealth({ manifest, health, now, total = 240, articleExpiry = Infinity }) {
  const issues = [];
  const generated = Date.parse(manifest.generatedAt);
  const checked = Date.parse(health.checkedAt);
  const entries = manifest.countries.flatMap(country =>
    Object.entries(country.feeds).map(([key, status]) => ({ key, status, country: country.id })));
  const statuses = entries.filter(entry => !isUnavailableFeed(entry.country, entry.key, entry.status))
    .map(entry => entry.status);
  const unavailable = entries.length - statuses.length;
  const ages = statuses.map(status => Date.parse(status.updatedAt));
  if (entries.length !== total || !statuses.length || ages.some(time => !Number.isFinite(time) || time > checked || now - time > 24 * HOUR)) {
    issues.push("Missing, future or over-24-hour feed timestamps.");
  }
  if (!Number.isFinite(generated) || !Number.isFinite(checked) || generated > checked || checked > now ||
      health.lastSuccessfulRefreshAt !== manifest.generatedAt || health.totalFeeds !== total ||
      health.publicationSafetyHours !== 24 || health.cacheLimitHours !== 24) {
    issues.push("Publication health timestamps or safety limits are inconsistent.");
  }
  const stale = statuses.filter(status => status.stale).length;
  if (health.cachedFeeds !== stale || health.refreshedFeeds !== total - stale - unavailable ||
      (health.unavailableFeeds ?? 0) !== unavailable ||
      health.state !== (stale || unavailable ? "degraded" : "healthy") ||
      !["cached", "refreshed"].includes(health.mode) || (health.mode === "cached" && stale + unavailable !== total)) {
    issues.push("Published health does not truthfully describe feed recovery.");
  }
  if (stale === 0 && ages.some(time => time < generated)) issues.push("Fresh publication has older feed timestamps.");
  return {
    valid: issues.length === 0, issues, cached: stale,
    oldestUpdatedAt: ages.length && ages.every(Number.isFinite) ? Math.min(...ages) : 0,
    expiresAt: ages.length && ages.every(Number.isFinite) && !Number.isNaN(articleExpiry)
      ? Math.min(...ages.map(time => time + 24 * HOUR), articleExpiry) : 0
  };
}
