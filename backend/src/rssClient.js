import { setTimeout as delay } from "node:timers/promises";
import { XMLParser, XMLValidator } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });

// Only these controlled fields reach logs. Never include response bodies, URLs,
// headers, or the original exception (which can contain credentials).
export class FeedRequestError extends Error {
  constructor(code, { status, retryable = false, retryAfterMs = 0 } = {}) {
    super(`RSS ${code}${status ? ` HTTP ${status}` : ""}`);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.attempts = 0;
  }
}

export class UpstreamUnavailableError extends Error {
  constructor(failure) {
    super(`RSS upstream failed for 5 consecutive feeds (${feedFailureLabel(failure)}); no files published.`);
    this.retryable = failure.retryable && ["network", "timeout", "invalid-rss", "http"].includes(failure.code);
    this.retryAfterMs = failure.retryAfterMs;
    this.failure = { code: failure.code, ...(failure.status ? { status: failure.status } : {}), attempts: failure.attempts };
  }
}

export function feedFailureLabel(error) {
  return error instanceof FeedRequestError
    ? `${error.code}${error.status ? ` HTTP ${error.status}` : ""}; attempts=${error.attempts}`
    : "unclassified feed error";
}

export async function fetchRSS(url, {
  fetchImpl = fetch,
  signal,
  timeoutMs = 20_000,
  sleep = delay,
  random = Math.random
} = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchImpl(url, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { "user-agent": "LatamDigestStaticFeedGenerator/1.0" }
      });
      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN;
        const retryAfterMs = Number.isFinite(seconds)
          ? Math.max(0, seconds * 1000)
          : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
        await response.body?.cancel();
        throw new FeedRequestError("http", {
          status: response.status,
          retryable: [408, 429].includes(response.status) || response.status >= 500,
          retryAfterMs
        });
      }
      const xml = await response.text();
      if (xml.length > 2_000_000 || /<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) {
        throw new FeedRequestError("invalid-rss", { retryable: true });
      }
      const parsed = parser.parse(xml);
      if (!parsed?.rss || parsed.rss.channel == null) {
        throw new FeedRequestError("invalid-rss", { retryable: true });
      }
      return parsed;
    } catch (error) {
      signal?.throwIfAborted();
      const failure = error instanceof FeedRequestError ? error : new FeedRequestError(
        timeout.aborted ? "timeout" : "network", { retryable: true }
      );
      failure.attempts = attempt;
      // Do not ignore a long Retry-After or wait beyond our retry budget.
      if (!failure.retryable || attempt === 3 || failure.retryAfterMs > 60_000) throw failure;
      const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(random() * 500);
      await sleep(Math.max(backoff, failure.retryAfterMs), undefined, { signal });
    }
  }
}
