import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../core/config/env';
import { KvCacheService, cacheKey } from './kv-service';

/** Safely call waitUntil if available (not present in test contexts). */
function safeWaitUntil(c: { executionCtx: { waitUntil(p: Promise<unknown>): void } }, p: Promise<unknown>) {
  try {
    c.executionCtx?.waitUntil(p);
  } catch {
    // In test/dev without ExecutionContext, just let the promise resolve.
  }
}

/**
 * Read-through cache middleware for public content GET routes.
 * Cache key is derived from the request pathname + query string.
 */
export function cacheRead(ttlSeconds = 300): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    // Only cache GET requests.
    if (c.req.method !== 'GET') {
      await next();
      return;
    }

    const cache = new KvCacheService(c.env);
    const key = cacheKey('http', c.req.path, c.req.url.split('?')[1] ?? '');

    const cached = await cache.get<{ status: number; body: unknown }>(key);
    if (cached) {
      c.header('x-cache', 'HIT');
      return c.json(cached.body, cached.status as 200);
    }

    await next();

    // Only cache successful JSON responses.
    if (c.res.status === 200 && c.res.headers.get('content-type')?.includes('json')) {
      // Clone so we can read without consuming.
      const cloned = c.res.clone();
      const body = await cloned.json();
      c.header('x-cache', 'MISS');

      // Fire-and-forget cache write.
      safeWaitUntil(c as never, cache.set(key, { status: 200, body }, ttlSeconds));
    }
  };
}

/**
 * Invalidation middleware for admin content mutation routes.
 * Runs after the handler; on successful writes, purges relevant cache keys.
 */
export function cacheInvalidate(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    await next();

    // Only invalidate on successful mutations.
    if (c.res.status >= 200 && c.res.status < 300) {
      const cache = new KvCacheService(c.env);
      safeWaitUntil(c as never, cache.invalidatePrefix('http:/api/public/content'));
    }
  };
}
