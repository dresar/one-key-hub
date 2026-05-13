type Entry = { expiresAt: number; value: unknown };

const map = new Map<string, Entry>();

export const cacheGet = <T>(key: string): T | null => {
  const e = map.get(key);
  if (!e) return null;
  if (Date.now() >= e.expiresAt) {
    map.delete(key);
    return null;
  }
  return e.value as T;
};

export const cacheSet = (key: string, value: unknown, ttlMs: number) => {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
};

export const cacheDel = (key: string) => {
  map.delete(key);
};

export const cacheDelByPrefix = (prefix: string) => {
  for (const k of map.keys()) {
    if (k.startsWith(prefix)) map.delete(k);
  }
};

