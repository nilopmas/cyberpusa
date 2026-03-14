import { describe, expect, it, beforeEach } from 'vitest';
import { RateLimiterDO } from './rate-limiter-do';

// ── Minimal DurableObjectState mock ────────────────────────────

function createMockState(): DurableObjectState {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get(key: string) { return Promise.resolve(store.get(key) ?? null); },
      put(key: string, value: unknown) { store.set(key, value); return Promise.resolve(); },
      delete(key: string) { store.delete(key); return Promise.resolve(true); },
      list() { return Promise.resolve(store); },
    },
  } as unknown as DurableObjectState;
}

// ── Tests ──────────────────────────────────────────────────────

describe('RateLimiterDO', () => {
  let state: DurableObjectState;
  let limiter: RateLimiterDO;

  beforeEach(() => {
    state = createMockState();
    limiter = new RateLimiterDO(state, {});
  });

  it('allows requests under the limit', async () => {
    const res = await limiter.fetch(
      new Request('https://rate-limiter.internal/check?max=5&window=60')
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; remaining: number };
    expect(body.ok).toBe(true);
    expect(body.remaining).toBe(4);
  });

  it('returns rate limit headers', async () => {
    const res = await limiter.fetch(
      new Request('https://rate-limiter.internal/check?max=10&window=60')
    );
    expect(res.headers.get('x-ratelimit-limit')).toBe('10');
    expect(res.headers.get('x-ratelimit-remaining')).toBe('9');
  });

  it('blocks requests when limit is reached', async () => {
    const url = 'https://rate-limiter.internal/check?max=3&window=60';

    // Exhaust the limit.
    for (let i = 0; i < 3; i++) {
      const res = await limiter.fetch(new Request(url));
      expect(res.status).toBe(200);
    }

    // Next request should be blocked.
    const blocked = await limiter.fetch(new Request(url));
    expect(blocked.status).toBe(429);
    const body = await blocked.json() as { ok: boolean; error: string; retryAfter: number };
    expect(body.ok).toBe(false);
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(blocked.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('decrements remaining count correctly', async () => {
    const url = 'https://rate-limiter.internal/check?max=5&window=60';

    const res1 = await limiter.fetch(new Request(url));
    expect((await res1.json() as { remaining: number }).remaining).toBe(4);

    const res2 = await limiter.fetch(new Request(url));
    expect((await res2.json() as { remaining: number }).remaining).toBe(3);
  });
});
