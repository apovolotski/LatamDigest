import https from 'node:https';

// Public publishers differ in HTTP-client compatibility. Use Node's standard
// HTTPS transport for publisher-owned endpoints (no cookies or credentials),
// keeping TLS verification, cancellation and a strict streaming body limit.
// Redirects are returned to the caller and must pass its exact-host policy.
export function publisherFetch(input, options = {}) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return Promise.reject(new Error('Invalid publisher URL'));
  }
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = https.get(url, {signal: options.signal, headers: options.headers}, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 2_000_000) response.destroy(new Error('Publisher response too large'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        const status = response.statusCode;
        if (options.redirect !== 'manual' && options.redirect !== 'error' && options.allowedHosts && [301,302,303,307,308].includes(status)) {
          try {
            const next = new URL(response.headers.location, url);
            if (!response.headers.location || !options.allowedHosts.includes(next.hostname) || (options.hops ?? 0) >= 3) throw new Error('Publisher redirect rejected');
            resolve(publisherFetch(next, {...options, hops: (options.hops ?? 0) + 1}));
          } catch (error) { reject(error); }
          return;
        }
        if (options.redirect === 'error' && [301,302,303,307,308].includes(status)) {
          reject(new Error('Publisher redirect rejected')); return;
        }
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        resolve(new Response([204,205,304].includes(status) ? null : Buffer.concat(chunks), {status, headers}));
      });
    });
    request.on('error', reject);
  });
}
