import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../../core/http/errors';
import { ok } from '../../core/http/response';
import type { Env } from '../../core/config/env';
import { getD1 } from '../../infra/db/client';
import { AuthService } from './service';
import { loginBody } from './schema';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post('/login', async (c) => {
  const parsed = loginBody.safeParse(await c.req.json());
  if (!parsed.success) {
    throw new AppError('Invalid login payload', {
      status: 400,
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }
  const svc = new AuthService(getD1(c.env));
  const session = await svc.login(parsed.data.email, parsed.data.password);
  return ok(session);
});
