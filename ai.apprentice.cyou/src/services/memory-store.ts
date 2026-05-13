/** Rate limit store (mirror Python MemoryStore.eval for gateway/dashboard). */
type Entry = { count: number; expiryAt: number };

const store = new Map<string, Entry>();

const sweep = (key: string) => {
  const e = store.get(key);
  if (!e) return;
  if (e.expiryAt <= Date.now()) store.delete(key);
};

export const memoryEval = (_script: string, _numKeys: number, key: string, _now: string, windowMs: string, limitStr: string) => {
  if (!key) return [0, 0, Number(limitStr) || 1000];
  const window = Number(windowMs) || 60000;
  const limit = Number(limitStr) || 1000;
  sweep(key);
  let e = store.get(key);
  if (!e) {
    e = { count: 0, expiryAt: Date.now() + window };
    store.set(key, e);
  }
  e.count += 1;
  if (e.count === 1) {
    e.expiryAt = Date.now() + window;
  }
  const ttl = Math.max(0, e.expiryAt - Date.now());
  const remaining = Math.max(0, limit - e.count);
  return [e.count, ttl, remaining];
};
