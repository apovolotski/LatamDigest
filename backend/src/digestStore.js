import { config } from "./config.js";
import { generateDigest } from "./openaiService.js";
import { getCountryName } from "./countries.js";

// Only the scheduled worker calls generation. Requests read the cache and cannot trigger billable work.
export function createDigestStore({ generate = generateDigest, ttlMs = config.cacheTtlMinutes * 60_000, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  function getCachedDigest(code) { return cache.get(code.toUpperCase())?.digest || null; }
  async function getDigest(code, { forceRefresh = false } = {}) {
    const countryCode = code.toUpperCase();
    const cached = cache.get(countryCode);
    if (!forceRefresh && cached && now() - cached.fetchedAt < ttlMs) return cached.digest;
    if (pending.has(countryCode)) return pending.get(countryCode);
    const request = Promise.resolve().then(() => generate({ countryCode, countryName: getCountryName(countryCode) }))
      .then(digest => { cache.set(countryCode, { digest, fetchedAt: now() }); return digest; })
      .finally(() => pending.delete(countryCode));
    pending.set(countryCode, request);
    return request;
  }
  return { getDigest, getCachedDigest };
}
const store = createDigestStore();
export const getDigest = store.getDigest;
export const getCachedDigest = store.getCachedDigest;
