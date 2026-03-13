import type { MiddlewareHandler } from 'hono';

const HEADER = 'x-request-id';

export type RequestIdVariables = { requestId: string };

/**
 * Middleware: reads or generates a request-id, sets it on the context
 * variables, echoes it in the response header, and logs the request.
 */
export function requestId(): MiddlewareHandler<{ Variables: RequestIdVariables }> {
  return async (c, next) => {
    const id = c.req.header(HEADER) ?? crypto.randomUUID();
    c.set('requestId', id);
    const start = Date.now();
    console.log(JSON.stringify({
      level: 'info',
      requestId: id,
      method: c.req.method,
      path: c.req.path,
      event: 'request_start',
    }));

    await next();

    // Ensure the header is on the actual response object.
    c.res.headers.set(HEADER, id);

    console.log(JSON.stringify({
      level: 'info',
      requestId: id,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - start,
      event: 'request_end',
    }));
  };
}
