import {publisherFetch} from './publisherHttp.js';
import {setTimeout as delay} from 'node:timers/promises';

// Publisher-owned WordPress archives supply discovery, never final date proof.
// Only explicit registry endpoints are used; response links cannot expand the
// request scope. The original article page must still verify each candidate.
export async function fetchPublisherArchive(source, options = {}) {
  const cache = options.requestContext?.publisherRSS ?? new Map();
  const key = `archive:${source.url}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    const items = [], seen = new Set();
    const after = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10) + 'T00:00:00';
    for (let page = 1; page <= (source.kind === 'outremers' ? 16 : 8); page++) {
      options.signal?.throwIfAborted();
      const url = new URL(source.url);
      if (source.kind === 'outremers') {
        url.searchParams.set('status', 'publish');
        url.searchParams.set('title', 'Guyane');
        url.searchParams.set('page', String(page));
      } else {
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));
        url.searchParams.set('after', after);
        url.searchParams.set('orderby', 'date');
        url.searchParams.set('order', 'desc');
        url.searchParams.set('_fields', 'id,date_gmt,link,title');
      }
      let posts = null, hasMore = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        const timeout = AbortSignal.timeout(8000);
        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        try {
          const response = await (options.fetchImpl ?? publisherFetch)(url, {signal, redirect: 'error',
            headers: {'user-agent': 'LatamDigestStaticFeedGenerator/1.0'}});
          if (!response.ok) {
            await response.body?.cancel();
            // Do not immediately retry a throttled publisher or ignore Retry-After.
            if (response.status < 500 || response.headers.get('retry-after')) break;
            throw new Error('publisher unavailable');
          }
          const body = await response.text();
          if (body.length > 2_000_000) break;
          let data;
          try { data = JSON.parse(body); } catch { break; }
          posts = source.kind === 'outremers' ? data?.['hydra:member'] : data;
          if (!Array.isArray(posts) || posts.length > 100) { posts = null; break; }
          hasMore = source.kind === 'outremers' ? Boolean(data['hydra:view']?.['hydra:next']) : posts.length === 100;
          break;
        } catch {
          options.signal?.throwIfAborted();
          if (attempt === 0) await (options.sleep ?? delay)(1000, undefined, {signal: options.signal});
        }
      }
      if (!posts) break;
      let added = 0;
      for (const post of posts) {
        if (!post || !Number.isSafeInteger(post.id) || seen.has(post.id)) continue;
        seen.add(post.id); added++;
        if (source.kind === 'outremers') {
          if (post.status !== 'publish' || typeof post.title !== 'string' || typeof post.alias !== 'string' || !/^[a-z0-9-]+$/.test(post.alias) || !Array.isArray(post.category) || !post.category.some(c => c?.alias === 'bassin-atlantique-appli')) continue;
          if (typeof post.createdAt !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(post.createdAt) || !Number.isFinite(Date.parse(post.createdAt))) continue;
          items.push({title: post.title, link: `https://outremers360.com/bassin-atlantique-appli/${post.alias}`, pubDate: post.createdAt});
          continue;
        }
        // WordPress explicitly defines date_gmt as publication in GMT. Ignore
        // modified_gmt and site-local dates; never substitute request time.
        if (typeof post.date_gmt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(post.date_gmt)) continue;
        if (typeof post.title?.rendered !== 'string' || typeof post.link !== 'string') continue;
        items.push({title: post.title.rendered, link: post.link, pubDate: post.date_gmt + 'Z'});
      }
      if (!hasMore || !added) break;
      if (source.kind === 'outremers' && posts.every(p => Number.isFinite(Date.parse(p?.createdAt)) && Date.parse(p?.createdAt) < Date.parse(after + 'Z'))) break;
    }
    return {rss: {channel: {item: items}}};
  })());
  return cache.get(key);
}
