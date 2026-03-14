import { describe, expect, it, beforeEach } from 'vitest';
import { KvCacheService, cacheKey } from './kv-service';
import type { Env } from '../../core/config/env';

// ── In-memory KV mock ──────────────────────────────────────────

function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expiration?: number }>();

  return {
    get(key: string) {
      const entry = store.get(key);
      if (!entry) return Promise.resolve(null);
      if (entry.expiration && Date.now() / 1000 > entry.expiration) {
        store.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(entry.value);
    },
    put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const expiration = opts?.expirationTtl
        ? Date.now() / 1000 + opts.expirationTtl
        : undefined;
      store.set(key, { value, expiration });
      return Promise.resolve();
    },
    delete(key: string) {
      store.delete(key);
      return Promise.resolve();
    },
    list(opts?: { prefix?: string }) {
      const keys = [...store.keys()]
        .filter((k) => !opts?.prefix || k.startsWith(opts.prefix))
        .map((name) => ({ name, expiration: undefined, metadata: undefined }));
      return Promise.resolve({ keys, list_complete: true, cacheStatus: null } as KVNamespaceListResult<unknown>);
    },
    getWithMetadata() { return Promise.resolve({ value: null, metadata: null, cacheStatus: null }); },
  } as unknown as KVNamespace;
}

// ── Tests ──────────────────────────────────────────────────────

describe('KvCacheService', () => {
  let kv: KVNamespace;
  let cache: KvCacheService;

  beforeEach(() => {
    kv = createMockKV();
    cache = new KvCacheService({ CACHE_KV: kv } as Env);
  });

  it('returns null for missing key', async () => {
    expect(await cache.get('nope')).toBeNull();
  });

  it('round-trips JSON values', async () => {
    await cache.set('foo', { bar: 42 });
    expect(await cache.get('foo')).toEqual({ bar: 42 });
  });

  it('deletes a key', async () => {
    await cache.set('x', 'y');
    await cache.delete('x');
    expect(await cache.get('x')).toBeNull();
  });

  it('invalidates by prefix', async () => {
    await cache.set('http:/api/public/content/collections:', []);
    await cache.set('http:/api/public/content/entries:', []);
    await cache.set('other:key', 'keep');

    await cache.invalidatePrefix('http:/api/public/content');

    expect(await cache.get('http:/api/public/content/collections:')).toBeNull();
    expect(await cache.get('http:/api/public/content/entries:')).toBeNull();
    expect(await cache.get('other:key')).toBe('keep');
  });

  it('gracefully handles missing KV binding', async () => {
    const noKv = new KvCacheService({} as Env);
    expect(await noKv.get('any')).toBeNull();
    await noKv.set('any', 'val'); // no throw
    await noKv.delete('any');     // no throw
  });
});

describe('cacheKey', () => {
  it('joins segments with colons', () => {
    expect(cacheKey('a', 'b', 'c')).toBe('a:b:c');
  });
});
