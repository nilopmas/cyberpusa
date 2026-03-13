import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('app', () => {
  const env = { ENVIRONMENT: 'development' } as never;

  it('returns healthz with 200', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/healthz', {
      headers: { 'content-type': 'application/json' }
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('returns x-request-id header (generated)', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/healthz', {}, env);

    const id = res.headers.get('x-request-id');
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('echoes provided x-request-id', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/healthz', {
      headers: { 'x-request-id': 'test-123' }
    }, env);

    expect(res.headers.get('x-request-id')).toBe('test-123');
  });

  it('returns 404 with error envelope for unknown routes', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/nope', {}, env);

    expect(res.status).toBe(404);
    const body = await res.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
