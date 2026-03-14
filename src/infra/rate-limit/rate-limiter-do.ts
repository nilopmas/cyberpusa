/**
 * Durable Object implementing a sliding-window rate limiter.
 *
 * Each unique client key maps to a DO instance. The DO stores
 * request timestamps in transactional storage and counts hits
 * within the window to decide allow/deny.
 */
export class RateLimiterDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: unknown
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const maxRequests = parseInt(url.searchParams.get('max') ?? '60', 10);
    const windowSeconds = parseInt(url.searchParams.get('window') ?? '60', 10);

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    // Get stored timestamps.
    const stored = (await this.state.storage.get<number[]>('timestamps')) ?? [];

    // Prune timestamps outside the window.
    const active = stored.filter((t) => t > cutoff);

    if (active.length >= maxRequests) {
      const retryAfter = Math.ceil((active[0] + windowMs - now) / 1000);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Rate limit exceeded',
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(retryAfter),
            'x-ratelimit-limit': String(maxRequests),
            'x-ratelimit-remaining': '0',
          },
        }
      );
    }

    // Record this request.
    active.push(now);
    await this.state.storage.put('timestamps', active);

    const remaining = maxRequests - active.length;
    return new Response(
      JSON.stringify({ ok: true, remaining }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-limit': String(maxRequests),
          'x-ratelimit-remaining': String(remaining),
        },
      }
    );
  }
}
