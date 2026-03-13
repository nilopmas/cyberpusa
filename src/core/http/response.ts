export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  const body: ApiResponse<T> = { success: true, data };
  return json(body, { status: 200, ...init });
}

export function created<T>(data: T, init?: ResponseInit): Response {
  const body: ApiResponse<T> = { success: true, data };
  return json(body, { status: 201, ...init });
}

export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {})
    }
  });
}
