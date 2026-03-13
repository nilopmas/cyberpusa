import { Hono } from 'hono';
import { parseEnv, type Env } from '../config/env';
import { AppError, toErrorResponse } from './errors';
import { ok } from './response';
import { contentAdminRoutes, contentPublicRoutes } from '../../modules/content/routes';

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

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

  app.get('/admin', (c) =>
    ok({
      area: 'admin-control-plane',
      message: 'Cyberpusa admin control plane is served directly by Cloudflare Workers.',
      todo: 'Replace this placeholder with real admin UI routes.'
    })
  );

  app.route('/api/public', contentPublicRoutes);
  app.route('/api/admin', contentAdminRoutes);

  app.onError((err) => toErrorResponse(err));

  app.notFound(() => toErrorResponse(new AppError('Not Found', { status: 404, code: 'NOT_FOUND' })));

  return app;
}
