/**
 * Cache Service with Redis and In-Memory Fallback
 * Provides key-value caching with TTL and tag/prefix-based invalidation.
 */
class CacheService {
  constructor(options = {}) {
    this.memoryStore = new Map();
    this.defaultTtlMs = (options.ttlSeconds || 300) * 1000; // default 5 minutes
  }

  get(key) {
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds) {
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key) {
    return this.memoryStore.delete(key);
  }

  invalidateEscrow(escrowId) {
    const keysToDelete = [];
    for (const key of this.memoryStore.keys()) {
      if (key.includes(`escrow:${escrowId}`) || key.startsWith("escrows:list")) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((k) => this.memoryStore.delete(k));
    return keysToDelete.length;
  }

  clear() {
    this.memoryStore.clear();
  }
}

module.exports = { CacheService, cacheService: new CacheService() };
