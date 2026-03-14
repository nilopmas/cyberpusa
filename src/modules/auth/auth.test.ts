import { describe, expect, it, beforeEach } from 'vitest';
import { createApp } from '../../core/http/app';
import { createMockD1 } from '../../test-utils/mock-d1';
import { AuthService } from './service';

function makeEnv(d1?: D1Database) {
  return {
    ENVIRONMENT: 'development',
    CMS_DB: d1 ?? createMockD1(),
  } as never;
}

function jsonReq(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

describe('auth module', () => {
  let app: ReturnType<typeof createApp>;
  let env: never;
  let d1: D1Database;

  beforeEach(() => {
    d1 = createMockD1();
    env = makeEnv(d1);
    app = createApp();
  });

  // ── Login ──────────────────────────────────────────────────

  describe('login', () => {
    it('rejects login with invalid credentials', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/auth/login', { email: 'nobody@test.com', password: 'wrongpass1' }),
        undefined,
        env
      );
      expect(res.status).toBe(401);
      const body = await res.json() as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects login with invalid payload', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/auth/login', { email: 'bad', password: '12' }),
        undefined,
        env
      );
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('logs in with valid credentials and returns session token', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('admin@test.com', 'password123', 'admin');

      const res = await app.request(
        jsonReq('POST', '/api/auth/login', { email: 'admin@test.com', password: 'password123' }),
        undefined,
        env
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { token: string; user: { email: string; role: string } } };
      expect(body.success).toBe(true);
      expect(body.data.token).toBeTruthy();
      expect(body.data.user.email).toBe('admin@test.com');
      expect(body.data.user.role).toBe('admin');
    });

    it('rejects login with wrong password', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('user@test.com', 'correctpass', 'viewer');

      const res = await app.request(
        jsonReq('POST', '/api/auth/login', { email: 'user@test.com', password: 'wrongpass1' }),
        undefined,
        env
      );
      expect(res.status).toBe(401);
    });
  });

  // ── Admin route protection ─────────────────────────────────

  describe('admin route protection', () => {
    it('rejects unauthenticated request to admin API', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }),
        undefined,
        env
      );
      expect(res.status).toBe(401);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects request with invalid bearer token', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }, {
          authorization: 'Bearer invalid-token-123',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(401);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_SESSION');
    });

    it('rejects viewer role from admin content API', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('viewer@test.com', 'password123', 'viewer');
      const session = await svc.login('viewer@test.com', 'password123');

      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }, {
          authorization: `Bearer ${session.token}`,
        }),
        undefined,
        env
      );
      expect(res.status).toBe(403);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('allows editor role to create content', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('editor@test.com', 'password123', 'editor');
      const session = await svc.login('editor@test.com', 'password123');

      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }, {
          authorization: `Bearer ${session.token}`,
        }),
        undefined,
        env
      );
      expect(res.status).toBe(201);
      const body = await res.json() as { success: boolean; data: { name: string } };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Blog');
    });

    it('allows admin role to create content', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('admin@test.com', 'password123', 'admin');
      const session = await svc.login('admin@test.com', 'password123');

      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Docs', slug: 'docs' }, {
          authorization: `Bearer ${session.token}`,
        }),
        undefined,
        env
      );
      expect(res.status).toBe(201);
    });

    it('allows owner role to create content', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('owner@test.com', 'password123', 'owner');
      const session = await svc.login('owner@test.com', 'password123');

      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Pages', slug: 'pages' }, {
          authorization: `Bearer ${session.token}`,
        }),
        undefined,
        env
      );
      expect(res.status).toBe(201);
    });

    it('preserves request-id in auth error responses', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }, {
          'x-request-id': 'test-req-id',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(401);
      const body = await res.json() as { meta: { requestId: string } };
      expect(body.meta.requestId).toBe('test-req-id');
    });
  });

  // ── Public routes remain open ──────────────────────────────

  describe('public routes remain open', () => {
    it('allows unauthenticated access to public content API', async () => {
      const res = await app.request(
        'http://localhost/api/public/content/collections',
        {},
        env
      );
      expect(res.status).toBe(200);
    });

    it('allows unauthenticated access to healthz', async () => {
      const res = await app.request('http://localhost/healthz', {}, env);
      expect(res.status).toBe(200);
    });

    it('allows unauthenticated access to admin login page', async () => {
      const res = await app.request('http://localhost/admin/login', {}, env);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Cyberpusa Admin Login');
    });
  });

  // ── AuthService unit tests ─────────────────────────────────

  describe('AuthService', () => {
    it('creates a user', async () => {
      const svc = new AuthService(d1);
      const user = await svc.createUser('new@test.com', 'password123', 'editor');
      expect(user.email).toBe('new@test.com');
      expect(user.role).toBe('editor');
      expect(user.id).toBeTruthy();
    });

    it('rejects duplicate email', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('dup@test.com', 'password123');
      await expect(svc.createUser('dup@test.com', 'otherpass1')).rejects.toThrow('Email already registered');
    });

    it('validates session token', async () => {
      const svc = new AuthService(d1);
      await svc.createUser('sess@test.com', 'password123', 'admin');
      const session = await svc.login('sess@test.com', 'password123');
      const user = await svc.validateSession(session.token);
      expect(user.email).toBe('sess@test.com');
      expect(user.role).toBe('admin');
    });

    it('rejects invalid session token', async () => {
      const svc = new AuthService(d1);
      await expect(svc.validateSession('nonexistent-token')).rejects.toThrow('Invalid or expired session');
    });
  });
});
