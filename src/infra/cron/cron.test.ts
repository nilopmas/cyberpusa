import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleScheduled } from './scheduled';
import { createMockD1 } from '../../test-utils/mock-d1';
import { AuthService } from '../../modules/auth/service';
import type { Env } from '../../core/config/env';

// ── Mock KV ────────────────────────────────────────────────────

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get(key: string) { return Promise.resolve(store.get(key) ?? null); },
    put(key: string, value: string) { store.set(key, value); return Promise.resolve(); },
    delete(key: string) { store.delete(key); return Promise.resolve(); },
    list() { return Promise.resolve({ keys: [], list_complete: true, cacheStatus: null }); },
    getWithMetadata() { return Promise.resolve({ value: null, metadata: null, cacheStatus: null }); },
  } as unknown as KVNamespace;
}

// ── Tests ──────────────────────────────────────────────────────

describe('handleScheduled', () => {
  let d1: D1Database;
  let env: Env;

  beforeEach(() => {
    d1 = createMockD1();
    env = {
      ENVIRONMENT: 'development',
      CMS_DB: d1,
      CACHE_KV: createMockKV(),
    } as Env;
  });

  it('cleans up expired sessions on */10 cron', async () => {
    const auth = new AuthService(d1);
    await auth.createUser('cron@test.com', 'pass1234', 'admin');
    await auth.login('cron@test.com', 'pass1234');

    // Expire the session.
    await d1.prepare(
      "UPDATE sessions SET expires_at = '2020-01-01T00:00:00.000Z'"
    ).run();

    const controller = {
      cron: '*/10 * * * *',
      scheduledTime: Date.now(),
      noRetry() {},
    } as ScheduledController;

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleScheduled(controller, env);

    // Session should be gone.
    const remaining = await d1.prepare('SELECT COUNT(*) as cnt FROM sessions').first<{ cnt: number }>();
    expect(remaining?.cnt).toBe(0);
    spy.mockRestore();
  });

  it('warms cache on 0 * * * * cron', async () => {
    const controller = {
      cron: '0 * * * *',
      scheduledTime: Date.now(),
      noRetry() {},
    } as ScheduledController;

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleScheduled(controller, env);

    // Verify something was written to cache.
    const cached = await env.CACHE_KV!.get('http:/api/public/content/collections:');
    expect(cached).toBeTruthy();
    spy.mockRestore();
  });

  it('handles missing bindings gracefully', async () => {
    const controller = {
      cron: '*/10 * * * *',
      scheduledTime: Date.now(),
      noRetry() {},
    } as ScheduledController;

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleScheduled(controller, { ENVIRONMENT: 'development' } as Env);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('CMS_DB not available'));
    spy.mockRestore();
  });
});
