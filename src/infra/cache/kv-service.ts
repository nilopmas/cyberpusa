import type { Env } from '../../core/config/env';

/** Default TTL for cached content (5 minutes). */
const DEFAULT_TTL_SECONDS = 300;

/**
 * Cache key conventions:
 *   content:collections           — list of all collections
 *   content:collections:{id}      — single collection by id
 *   content:entries               — list of all entries
 *   content:entries:col:{colId}   — entries filtered by collection
 *   content:entries:{id}          — single entry by id
 */
export function cacheKey(...segments: string[]): string {
  return segments.join(':');
}

export class KvCacheService {
  private readonly kv: KVNamespace | undefined;

  constructor(env: Env) {
    this.kv = env?.CACHE_KV;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.kv?.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    if (!this.kv) return;
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  }

  async delete(key: string): Promise<void> {
    if (!this.kv) return;
    await this.kv.delete(key);
  }

  /** Delete all keys matching a prefix by listing then deleting. */
  async invalidatePrefix(prefix: string): Promise<void> {
    if (!this.kv) return;
    const list = await this.kv.list({ prefix });
    await Promise.all(list.keys.map((k) => this.kv!.delete(k.name)));
  }
}
