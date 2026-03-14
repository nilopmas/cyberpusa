import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../core/config/env';
import { AppError } from '../../core/http/errors';
import { getD1 } from '../../infra/db/client';
import { AuthService } from './service';
import type { AuthUser, UserRole } from './schema';

export type AuthVariables = { authUser: AuthUser };

/**
 * Middleware: extracts Bearer token from Authorization header,
 * validates the session, and sets the authenticated user on context.
 */
export function requireAuth(): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> {
  return async (c, next) => {
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', { status: 401, code: 'UNAUTHORIZED' });
    }
    const token = header.slice(7);
    const svc = new AuthService(getD1(c.env));
    const user = await svc.validateSession(token);
    c.set('authUser', user);
    await next();
  };
}

/**
 * Middleware: checks that the authenticated user has one of the required roles.
 * Must run after requireAuth().
 */
export function requireRole(...allowed: UserRole[]): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const user = c.get('authUser');
    if (!user || !allowed.includes(user.role)) {
      throw new AppError('Insufficient permissions', { status: 403, code: 'FORBIDDEN' });
    }
    await next();
  };
}
