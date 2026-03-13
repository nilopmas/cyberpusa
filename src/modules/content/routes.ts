import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../../core/http/errors';
import { created, ok } from '../../core/http/response';
import type { Env } from '../../core/config/env';
import { ContentService } from './service';

const createCollectionBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1)
});

const createEntryBody = z.object({
  collectionId: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().optional(),
  status: z.enum(['draft', 'published']).optional()
});

const service = new ContentService();

export const contentPublicRoutes = new Hono<{ Bindings: Env }>();
export const contentAdminRoutes = new Hono<{ Bindings: Env }>();

contentPublicRoutes.get('/content/collections', (c) => ok(service.listCollections()));
contentPublicRoutes.get('/content/entries', (c) => {
  const collectionId = c.req.query('collectionId');
  return ok(service.listEntries(collectionId));
});

contentAdminRoutes.post('/content/collections', async (c) => {
  const body = await c.req.json();
  const parsed = createCollectionBody.safeParse(body);
  if (!parsed.success) {
    throw new AppError('Invalid collection payload', {
      status: 400,
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten()
    });
  }
  return created(service.createCollection(parsed.data));
});

contentAdminRoutes.post('/content/entries', async (c) => {
  const body = await c.req.json();
  const parsed = createEntryBody.safeParse(body);
  if (!parsed.success) {
    throw new AppError('Invalid entry payload', {
      status: 400,
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten()
    });
  }

  return created(
    service.createEntry({
      ...parsed.data,
      body: parsed.data.body ?? '',
      status: parsed.data.status ?? 'draft'
    })
  );
});
