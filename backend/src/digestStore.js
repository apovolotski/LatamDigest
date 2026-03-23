import { config } from "./config.js";
import { generateDigest } from "./openaiService.js";
import { getCountryName } from "./countries.js";

const cache = new Map();

export async function getDigest(countryCode, { forceRefresh = false } = {}) {
  const normalized = countryCode.toUpperCase();
  const cached = cache.get(normalized);

  if (!forceRefresh && cached && !isExpired(cached.fetchedAt)) {
    return cached.digest;
  }

  const digest = await generateDigest({
    countryCode: normalized,
    countryName: getCountryName(normalized)
  });

  cache.set(normalized, {
    digest,
    fetchedAt: Date.now()
  });

  return digest;
}

export function getCachedDigest(countryCode) {
  return cache.get(countryCode.toUpperCase())?.digest || null;
}

function isExpired(fetchedAt) {
  const ageMs = Date.now() - fetchedAt;
  const ttlMs = config.cacheTtlMinutes * 60 * 1000;
  return ageMs > ttlMs;
}
