// Tiny in-memory query cache so navigating between pages doesn't refetch
// everything every time. Returns cached data if it's still fresh (within ttl),
// otherwise runs the fetcher and caches the result.
// Mutations should call invalidate(key) so the next read refetches.

const store = new Map();
const DEFAULT_TTL = 30_000; // 30s

export async function cachedQuery(key, fetcher, ttl = DEFAULT_TTL) {
  const entry = store.get(key);
  if (entry && Date.now() - entry.t < ttl) return entry.v;
  const v = await fetcher();
  store.set(key, { v, t: Date.now() });
  return v;
}

export function invalidate(key) {
  if (key) store.delete(key);
  else store.clear();
}
