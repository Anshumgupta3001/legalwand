/* ── Simple in-memory TTL cache (no external dependency) ── */

class TTLCache {
  constructor(defaultTtlMs = 5 * 60 * 1000 /* 5 min */) {
    this._store   = new Map();
    this._default = defaultTtlMs;

    /* Periodic GC every 10 min */
    this._gc = setInterval(() => this._sweep(), 10 * 60 * 1000);
    if (this._gc.unref) this._gc.unref(); /* don't block process exit */
  }

  set(key, value, ttlMs) {
    this._store.set(key, {
      value,
      exp: Date.now() + (ttlMs ?? this._default),
    });
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.exp) { this._store.delete(key); return undefined; }
    return entry.value;
  }

  has(key) { return this.get(key) !== undefined; }

  del(key)   { this._store.delete(key); }
  clear()    { this._store.clear(); }

  _sweep() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now > v.exp) this._store.delete(k);
    }
  }
}

/* ── Shared cache instances ── */
const filterOptionsCache = new TTLCache(10 * 60 * 1000); /* 10 min */
const queryCache         = new TTLCache(3  * 60 * 1000); /* 3 min  */
const analyticsCache     = new TTLCache(15 * 60 * 1000); /* 15 min */

module.exports = { TTLCache, filterOptionsCache, queryCache, analyticsCache };
