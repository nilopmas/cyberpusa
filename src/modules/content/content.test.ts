import { describe, expect, it, beforeEach } from 'vitest';
import { createApp } from '../../core/http/app';
import { createMockD1 } from '../../test-utils/mock-d1';

function makeEnv(d1?: D1Database) {
  return {
    ENVIRONMENT: 'development',
    CMS_DB: d1 ?? createMockD1(),
  } as never;
}

function jsonReq(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

describe('content module', () => {
  let app: ReturnType<typeof createApp>;
  let env: never;

  beforeEach(() => {
    app = createApp();
    env = makeEnv();
  });

  // ── Collections ────────────────────────────────────────────

  describe('collections CRUD', () => {
    it('lists collections (empty initially)', async () => {
      const res = await app.request('http://localhost/api/public/content/collections', {}, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('creates a collection', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }),
        undefined,
        env
      );
      expect(res.status).toBe(201);
      const body = await res.json() as { success: boolean; data: { id: string; name: string; slug: string } };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Blog');
      expect(body.data.slug).toBe('blog');
      expect(body.data.id).toBeTruthy();
    });

    it('rejects duplicate collection slug', async () => {
      const req1 = jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' });
      await app.request(req1, undefined, env);

      const req2 = jsonReq('POST', '/api/admin/content/collections', { name: 'Blog 2', slug: 'blog' });
      const res = await app.request(req2, undefined, env);
      expect(res.status).toBe(409);
      const body = await res.json() as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SLUG_EXISTS');
    });

    it('gets a collection by id', async () => {
      const createRes = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Docs', slug: 'docs' }),
        undefined,
        env
      );
      const created = await createRes.json() as { data: { id: string } };

      const res = await app.request(
        `http://localhost/api/public/content/collections/${created.data.id}`,
        {},
        env
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { slug: string } };
      expect(body.data.slug).toBe('docs');
    });

    it('returns 404 for missing collection', async () => {
      const res = await app.request(
        'http://localhost/api/public/content/collections/nonexistent',
        {},
        env
      );
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('COLLECTION_NOT_FOUND');
    });

    it('updates a collection', async () => {
      const createRes = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }),
        undefined,
        env
      );
      const created = await createRes.json() as { data: { id: string } };

      const res = await app.request(
        jsonReq('PUT', `/api/admin/content/collections/${created.data.id}`, { name: 'Articles' }),
        undefined,
        env
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { name: string; slug: string } };
      expect(body.data.name).toBe('Articles');
      expect(body.data.slug).toBe('blog');
    });

    it('deletes an empty collection', async () => {
      const createRes = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Temp', slug: 'temp' }),
        undefined,
        env
      );
      const created = await createRes.json() as { data: { id: string } };

      const res = await app.request(
        jsonReq('DELETE', `/api/admin/content/collections/${created.data.id}`),
        undefined,
        env
      );
      expect(res.status).toBe(200);
    });

    it('rejects deleting a collection with entries', async () => {
      const colRes = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }),
        undefined,
        env
      );
      const col = await colRes.json() as { data: { id: string } };

      await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId: col.data.id,
          title: 'Post',
          slug: 'post',
        }),
        undefined,
        env
      );

      const res = await app.request(
        jsonReq('DELETE', `/api/admin/content/collections/${col.data.id}`),
        undefined,
        env
      );
      expect(res.status).toBe(409);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('COLLECTION_NOT_EMPTY');
    });
  });

  // ── Entries ────────────────────────────────────────────────

  describe('entries CRUD', () => {
    let collectionId: string;

    beforeEach(async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Blog', slug: 'blog' }),
        undefined,
        env
      );
      const body = await res.json() as { data: { id: string } };
      collectionId = body.data.id;
    });

    it('creates an entry with default draft status', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'Hello World',
          slug: 'hello-world',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(201);
      const body = await res.json() as { data: { title: string; status: string; collectionId: string } };
      expect(body.data.title).toBe('Hello World');
      expect(body.data.status).toBe('draft');
      expect(body.data.collectionId).toBe(collectionId);
    });

    it('creates an entry with scheduled status', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'Future Post',
          slug: 'future-post',
          status: 'scheduled',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(201);
      const body = await res.json() as { data: { status: string } };
      expect(body.data.status).toBe('scheduled');
    });

    it('rejects duplicate entry slug within same collection', async () => {
      await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'Post A',
          slug: 'same-slug',
        }),
        undefined,
        env
      );

      const res = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'Post B',
          slug: 'same-slug',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(409);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('SLUG_EXISTS');
    });

    it('allows same slug in different collections', async () => {
      const col2Res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: 'Docs', slug: 'docs' }),
        undefined,
        env
      );
      const col2 = await col2Res.json() as { data: { id: string } };

      await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'Intro',
          slug: 'intro',
        }),
        undefined,
        env
      );

      const res = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId: col2.data.id,
          title: 'Intro',
          slug: 'intro',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(201);
    });

    it('lists entries filtered by collection', async () => {
      await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'Post 1',
          slug: 'post-1',
        }),
        undefined,
        env
      );

      const res = await app.request(
        `http://localhost/api/public/content/entries?collectionId=${collectionId}`,
        {},
        env
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: unknown[] };
      expect(body.data).toHaveLength(1);
    });

    it('gets an entry by id', async () => {
      const createRes = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'My Post',
          slug: 'my-post',
        }),
        undefined,
        env
      );
      const created = await createRes.json() as { data: { id: string } };

      const res = await app.request(
        `http://localhost/api/public/content/entries/${created.data.id}`,
        {},
        env
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { title: string } };
      expect(body.data.title).toBe('My Post');
    });

    it('returns 404 for missing entry', async () => {
      const res = await app.request(
        'http://localhost/api/public/content/entries/nonexistent',
        {},
        env
      );
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('ENTRY_NOT_FOUND');
    });

    it('updates an entry', async () => {
      const createRes = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'Draft',
          slug: 'draft-post',
        }),
        undefined,
        env
      );
      const created = await createRes.json() as { data: { id: string } };

      const res = await app.request(
        jsonReq('PUT', `/api/admin/content/entries/${created.data.id}`, {
          title: 'Published Post',
          status: 'published',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { title: string; status: string } };
      expect(body.data.title).toBe('Published Post');
      expect(body.data.status).toBe('published');
    });

    it('deletes an entry', async () => {
      const createRes = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId,
          title: 'To Delete',
          slug: 'to-delete',
        }),
        undefined,
        env
      );
      const created = await createRes.json() as { data: { id: string } };

      const delRes = await app.request(
        jsonReq('DELETE', `/api/admin/content/entries/${created.data.id}`),
        undefined,
        env
      );
      expect(delRes.status).toBe(200);

      const getRes = await app.request(
        `http://localhost/api/public/content/entries/${created.data.id}`,
        {},
        env
      );
      expect(getRes.status).toBe(404);
    });

    it('rejects entry for nonexistent collection', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId: 'does-not-exist',
          title: 'Orphan',
          slug: 'orphan',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('COLLECTION_NOT_FOUND');
    });
  });

  // ── Validation ─────────────────────────────────────────────

  describe('input validation', () => {
    it('rejects collection with empty name', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/collections', { name: '', slug: 'ok' }),
        undefined,
        env
      );
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects entry with invalid status', async () => {
      const res = await app.request(
        jsonReq('POST', '/api/admin/content/entries', {
          collectionId: 'x',
          title: 'T',
          slug: 's',
          status: 'archived',
        }),
        undefined,
        env
      );
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
