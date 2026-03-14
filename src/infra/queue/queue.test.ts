import { describe, expect, it, beforeEach, vi } from 'vitest';
import { dispatchQueueMessage, processQueueBatch } from './dispatcher';
import { handleSessionCleanup } from './handlers';
import { createMockD1 } from '../../test-utils/mock-d1';
import { AuthService } from '../../modules/auth/service';
import type { Env } from '../../core/config/env';

// ── dispatchQueueMessage ───────────────────────────────────────

describe('dispatchQueueMessage', () => {
  it('sends a valid message to the queue', async () => {
    const sent: unknown[] = [];
    const mockQueue = { send: (msg: unknown) => { sent.push(msg); return Promise.resolve(); } } as Queue;

    await dispatchQueueMessage(mockQueue, {
      type: 'content.published',
      payload: { entryId: '123' },
    });

    expect(sent).toHaveLength(1);
    expect((sent[0] as { type: string }).type).toBe('content.published');
  });

  it('skips enqueue when queue binding is absent', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await dispatchQueueMessage(undefined, {
      type: 'session.cleanup',
      payload: {},
    });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('not configured'),
      'session.cleanup'
    );
    spy.mockRestore();
  });

  it('rejects invalid message type', async () => {
    await expect(
      dispatchQueueMessage(undefined, {
        type: 'invalid.type' as 'content.published',
        payload: {},
      })
    ).rejects.toThrow();
  });
});

// ── processQueueBatch ──────────────────────────────────────────

describe('processQueueBatch', () => {
  it('acks messages after successful processing', async () => {
    const acked: string[] = [];
    const batch = {
      queue: 'cyberpusa-jobs',
      messages: [
        {
          id: 'msg-1',
          body: { type: 'content.published', payload: { entryId: 'e1' } },
          ack() { acked.push(this.id); },
          retry() { throw new Error('should not retry'); },
        },
      ],
    } as unknown as MessageBatch<unknown>;

    await processQueueBatch(batch, {} as Env);
    expect(acked).toEqual(['msg-1']);
  });

  it('retries messages on handler error', async () => {
    const retried: string[] = [];
    const batch = {
      queue: 'cyberpusa-jobs',
      messages: [
        {
          id: 'msg-2',
          body: { type: 'session.cleanup', payload: {} },
          ack() { throw new Error('should not ack'); },
          retry() { retried.push(this.id); },
        },
      ],
    } as unknown as MessageBatch<unknown>;

    // session.cleanup without CMS_DB will throw inside the handler.
    // But we catch errors gracefully so it should retry.
    // Actually the handler checks if env.CMS_DB exists first. Let's give it a bad DB.
    const env = { CMS_DB: { prepare: () => { throw new Error('db error'); } } } as unknown as Env;

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await processQueueBatch(batch, env);
    expect(retried).toEqual(['msg-2']);
    spy.mockRestore();
  });
});

// ── handleSessionCleanup ───────────────────────────────────────

describe('handleSessionCleanup', () => {
  let d1: D1Database;

  beforeEach(() => {
    d1 = createMockD1();
  });

  it('removes expired sessions', async () => {
    // Create a user and login to generate a session.
    const auth = new AuthService(d1);
    await auth.createUser('test@test.com', 'password123', 'admin');
    await auth.login('test@test.com', 'password123');

    // Manually expire the session by updating expires_at to the past.
    await d1.prepare(
      "UPDATE sessions SET expires_at = '2020-01-01T00:00:00.000Z'"
    ).run();

    const count = await handleSessionCleanup(d1);
    expect(count).toBe(1);

    // Verify session is gone.
    const remaining = await d1.prepare('SELECT COUNT(*) as cnt FROM sessions').first<{ cnt: number }>();
    expect(remaining?.cnt).toBe(0);
  });

  it('returns 0 when no expired sessions exist', async () => {
    const count = await handleSessionCleanup(d1);
    expect(count).toBe(0);
  });
});
