import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../core/config/env';

export interface RateLimitOptions {
  /** Max requests per window. Default: 60 */
  maxRequests?: number;
  /** Window size in seconds. Default: 60 */
  windowSeconds?: number;
}

/**
 * Rate-limiting middleware backed by the RateLimiterDO Durable Object.
 *
 * The client key is derived from the CF-Connecting-IP header (or
 * x-forwarded-for fallback). Each unique key gets its own DO instance
 * implementing a sliding window counter.
 *
 * When the RATE_LIMITER binding is absent (e.g. local dev / tests),
 * the middleware passes through without limiting.
 */
export function rateLimit(opts: RateLimitOptions = {}): MiddlewareHandler<{ Bindings: Env }> {
  const maxRequests = opts.maxRequests ?? 60;
  const windowSeconds = opts.windowSeconds ?? 60;

  return async (c, next) => {
    const ns = c.env?.RATE_LIMITER;
    if (!ns) {
      // No DO binding — skip (dev / test).
      await next();
      return;
    }

    const clientIp =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';

    // Use the route prefix + IP as the DO key for per-route limiting.
    const prefix = c.req.path.split('/').slice(0, 3).join('/');
    const doKey = `${prefix}:${clientIp}`;
    const id = ns.idFromName(doKey);
    const stub = ns.get(id);

    const doUrl = `https://rate-limiter.internal/check?max=${maxRequests}&window=${windowSeconds}`;
    const doRes = await stub.fetch(doUrl);

    // Forward rate limit headers.
    const limit = doRes.headers.get('x-ratelimit-limit');
    const remaining = doRes.headers.get('x-ratelimit-remaining');
    if (limit) c.header('x-ratelimit-limit', limit);
    if (remaining) c.header('x-ratelimit-remaining', remaining);

    if (doRes.status === 429) {
      const retryAfter = doRes.headers.get('retry-after') ?? '60';
      c.header('retry-after', retryAfter);
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          },
        },
        429
      );
    }

    await next();
  };
}
