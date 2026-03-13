import { Hono } from 'hono';
import { parseEnv, type Env } from '../config/env';
import { AppError, toErrorResponse } from './errors';
import { ok } from './response';
import { requestId, type RequestIdVariables } from './request-id';
import { contentAdminRoutes, contentPublicRoutes } from '../../modules/content/routes';

type AppEnv = { Bindings: Env; Variables: RequestIdVariables };

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

  app.get('/admin', (c) =>
    ok({
      area: 'admin-control-plane',
      message: 'Cyberpusa admin control plane is served directly by Cloudflare Workers.',
      todo: 'Replace this placeholder with real admin UI routes.'
    })
  );

  app.route('/api/public', contentPublicRoutes);
  app.route('/api/admin', contentAdminRoutes);

  app.onError((err, c) => toErrorResponse(err, c.get('requestId')));

  app.notFound((c) =>
    toErrorResponse(new AppError('Not Found', { status: 404, code: 'NOT_FOUND' }), c.get('requestId'))
  );

  return app;
}
