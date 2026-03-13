import { json } from './response';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'INTERNAL_ERROR';
    this.details = options?.details;
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.status }
    );
  }

  return json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error'
      }
    },
    { status: 500 }
  );
}
