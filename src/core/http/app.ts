import { Hono } from 'hono';
import { parseEnv, type Env } from '../config/env';
import { AppError, toErrorResponse } from './errors';
import { ok } from './response';
import { requestId, type RequestIdVariables } from './request-id';
import { contentAdminRoutes, contentPublicRoutes } from '../../modules/content/routes';
import { authRoutes } from '../../modules/auth/routes';
import { adminPages } from '../../modules/admin/pages';
import { requireAuth, requireRole, type AuthVariables } from '../../modules/auth/middleware';
import { rateLimit } from '../../infra/rate-limit/rate-limit-middleware';
import { cacheRead, cacheInvalidate } from '../../infra/cache/cache-middleware';

type AppEnv = { Bindings: Env; Variables: RequestIdVariables & AuthVariables };

export function createApp() {
  const app = new Hono<AppEnv>();

  // Request-ID + structured logging (runs first).
  app.use('*', requestId());

  app.use('*', async (c, next) => {
    // Validate shape early so route handlers can trust bindings.
    parseEnv(c.env);
    await next();
  });

  app.get('/healthz', (c) =>
    ok({
      service: 'cyberpusa',
      status: 'ok',
      runtime: 'cloudflare-workers'
    })
  );

  // Rate limit auth endpoints.
  app.use('/api/auth/*', rateLimit({ maxRequests: 10, windowSeconds: 60 }));

  // Auth API routes (public — login).
  app.route('/api/auth', authRoutes);

  // Admin control plane pages (served as HTML by Workers).
  app.route('/admin', adminPages);

  // Public content API — KV read-through cache (5 min TTL).
  app.use('/api/public/*', cacheRead());
  app.route('/api/public', contentPublicRoutes);

  // Admin content API — auth + RBAC guard + cache invalidation.
  app.use('/api/admin/*', rateLimit({ maxRequests: 60, windowSeconds: 60 }));
  app.use('/api/admin/*', requireAuth(), requireRole('owner', 'admin', 'editor'));
  app.use('/api/admin/*', cacheInvalidate());
  app.route('/api/admin', contentAdminRoutes);

  app.onError((err, c) => toErrorResponse(err, c.get('requestId')));

  app.notFound((c) =>
    toErrorResponse(new AppError('Not Found', { status: 404, code: 'NOT_FOUND' }), c.get('requestId'))
  );

  return app;
}
