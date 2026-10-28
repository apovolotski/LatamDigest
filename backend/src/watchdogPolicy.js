const HOUR = 3_600_000;
export const WORKFLOWS = {
  feeds: { file: "refresh-static-feeds.yml", name: "Refresh Static Feeds", cron: "17 */6 * * *", cooldown: 6 * HOUR },
  backend: { file: "backend-checks.yml", name: "Backend Checks", cron: "43 10 * * *", cooldown: 24 * HOUR }
};
export const activeRun = run => run.status !== "completed";
export const mainRun = (run, repository) => run.head_branch === "main" &&
  run.event !== "pull_request" && run.head_repository?.full_name === repository;

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
  const statuses = manifest.countries.flatMap(country => Object.values(country.feeds));
  const ages = statuses.map(status => Date.parse(status.updatedAt));
  if (statuses.length !== total || ages.some(time => !Number.isFinite(time) || time > checked || now - time > 24 * HOUR)) {
    issues.push("Missing, future or over-24-hour feed timestamps.");
  }
  if (!Number.isFinite(generated) || !Number.isFinite(checked) || generated > checked || checked > now ||
      health.lastSuccessfulRefreshAt !== manifest.generatedAt || health.totalFeeds !== total ||
      health.publicationSafetyHours !== 24 || health.cacheLimitHours !== 24) {
    issues.push("Publication health timestamps or safety limits are inconsistent.");
  }
  const stale = statuses.filter(status => status.stale).length;
  if (health.cachedFeeds !== stale || health.refreshedFeeds !== total - stale ||
      health.state !== (stale ? "degraded" : "healthy") ||
      !["cached", "refreshed"].includes(health.mode) || (health.mode === "cached" && stale !== total)) {
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
