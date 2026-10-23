// Published articles need to remain valid between scheduled runs, including a
// full day of safe outage recovery. The reader/validator limit remains 14 days.
export const MAX_ARTICLE_AGE_MS = 14 * 86_400_000;
export const PUBLICATION_SAFETY_MS = 24 * 3600_000;
export const MAX_PUBLICATION_AGE_MS = MAX_ARTICLE_AGE_MS - PUBLICATION_SAFETY_MS;
export const MAX_CACHE_AGE_MS = 24 * 3600_000;
