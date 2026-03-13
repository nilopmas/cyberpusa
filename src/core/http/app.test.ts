import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('app', () => {
  it('returns healthz', async () => {
    const app = createApp();

    const res = await app.request('http://localhost/healthz', {
      headers: { 'content-type': 'application/json' }
    }, {
      ENVIRONMENT: 'development'
    } as never);

    expect(res.status).toBe(200);
  });
});
