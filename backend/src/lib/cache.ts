// ─── In-Memory LRU Cache ──────────────────────────────────────────────────────
// Lightweight alternative to Redis. Optimized for low RAM (3GB server).
// Uses TTL-based expiry with Map (preserves insertion order for LRU eviction).

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number; // milliseconds

  constructor(options: { maxSize?: number; defaultTTL?: number } = {}) {
    this.maxSize = options.maxSize ?? 500;
    this.defaultTTL = options.defaultTTL ?? 60_000; // 60 seconds default
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// ─── Singleton Cache Instances ────────────────────────────────────────────────

/** Cache for active credentials per provider — TTL 60s */
export const credentialCache = new TTLCache<any[]>({
  maxSize: 100,
  defaultTTL: 60_000,
});

/** Cache for dashboard stats — TTL 30s */
export const statsCache = new TTLCache<any>({
  maxSize: 10,
  defaultTTL: 30_000,
});

/** Cache for models per provider — TTL 10 min */
export const modelsCache = new TTLCache<any[]>({
  maxSize: 50,
  defaultTTL: 600_000,
});

/** Cache for gateway key validation — TTL 2 min */
export const gatewayKeyCache = new TTLCache<any>({
  maxSize: 500,
  defaultTTL: 120_000,
});
