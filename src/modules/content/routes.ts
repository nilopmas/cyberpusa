import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../../core/http/errors';
import { created, ok } from '../../core/http/response';
import type { Env } from '../../core/config/env';
import { getD1 } from '../../infra/db/client';
import { ContentService } from './service';
import { contentStatus } from './schema';

// ── Request body schemas ───────────────────────────────────────

const createCollectionBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
});

const updateCollectionBody = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

const createEntryBody = z.object({
  collectionId: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().optional(),
  status: contentStatus.optional(),
});

const updateEntryBody = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  body: z.string().optional(),
  status: contentStatus.optional(),
});

// ── Helpers ────────────────────────────────────────────────────

function svc(env: Env) {
  return new ContentService(getD1(env));
}

function validate<T>(schema: z.ZodType<T>, data: unknown, entity: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(`Invalid ${entity} payload`, {
      status: 400,
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

// ── Public routes (read-only) ──────────────────────────────────

export const contentPublicRoutes = new Hono<{ Bindings: Env }>();

contentPublicRoutes.get('/content/collections', async (c) => {
  return ok(await svc(c.env).listCollections());
});

contentPublicRoutes.get('/content/collections/:id', async (c) => {
  return ok(await svc(c.env).getCollection(c.req.param('id')));
});

contentPublicRoutes.get('/content/entries', async (c) => {
  const collectionId = c.req.query('collectionId');
  return ok(await svc(c.env).listEntries(collectionId));
});

contentPublicRoutes.get('/content/entries/:id', async (c) => {
  return ok(await svc(c.env).getEntry(c.req.param('id')));
});

// ── Admin routes (mutations) ───────────────────────────────────

export const contentAdminRoutes = new Hono<{ Bindings: Env }>();

contentAdminRoutes.post('/content/collections', async (c) => {
  const data = validate(createCollectionBody, await c.req.json(), 'collection');
  return created(await svc(c.env).createCollection(data));
});

contentAdminRoutes.put('/content/collections/:id', async (c) => {
  const data = validate(updateCollectionBody, await c.req.json(), 'collection');
  return ok(await svc(c.env).updateCollection(c.req.param('id'), data));
});

contentAdminRoutes.delete('/content/collections/:id', async (c) => {
  await svc(c.env).deleteCollection(c.req.param('id'));
  return ok({ deleted: true });
});

contentAdminRoutes.post('/content/entries', async (c) => {
  const data = validate(createEntryBody, await c.req.json(), 'entry');
  return created(
    await svc(c.env).createEntry({
      ...data,
      body: data.body ?? '',
      status: data.status ?? 'draft',
    })
  );
});

contentAdminRoutes.put('/content/entries/:id', async (c) => {
  const data = validate(updateEntryBody, await c.req.json(), 'entry');
  return ok(await svc(c.env).updateEntry(c.req.param('id'), data));
});

contentAdminRoutes.delete('/content/entries/:id', async (c) => {
  await svc(c.env).deleteEntry(c.req.param('id'));
  return ok({ deleted: true });
});
