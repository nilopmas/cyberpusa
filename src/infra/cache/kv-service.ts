import type { Env } from '../../core/config/env';

export class KvCacheService {
  constructor(private readonly env: Env) {}

  async get(key: string): Promise<string | null> {
    return this.env.CACHE_KV?.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds = 60): Promise<void> {
    if (!this.env.CACHE_KV) return;
    await this.env.CACHE_KV.put(key, value, { expirationTtl: ttlSeconds });
  }
}
