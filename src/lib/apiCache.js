const cache = new Map();
const inflight = new Map();

function getEntry(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data, ttlMs = 60_000) {
  cache.set(key, { data, time: Date.now(), ttl: ttlMs });
}

export function invalidateCache(prefix = '') {
  for (const key of [...cache.keys()]) {
    if (!prefix || key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
  for (const key of [...inflight.keys()]) {
    if (!prefix || key.startsWith(prefix)) {
      inflight.delete(key);
    }
  }
}

/** In-memory GET cache with in-flight deduplication. */
export async function dedupedFetch(key, ttlMs, fetcher) {
  const cached = getEntry(key);
  if (cached !== null) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      setCached(key, data, ttlMs);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function cacheKey(parts) {
  return parts.filter(Boolean).join(':');
}
