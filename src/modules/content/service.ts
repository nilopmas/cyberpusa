import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../../core/http/errors';
import { collections, entries } from '../../infra/db/schema/index';
import type { Collection, Entry } from './schema';

type Db = ReturnType<typeof drizzle>;

export class ContentService {
  private db: Db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  // ── Collections ──────────────────────────────────────────────

  async listCollections(): Promise<Collection[]> {
    return this.db.select().from(collections);
  }

  async getCollection(id: string): Promise<Collection> {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, id));
    if (!row) {
      throw new AppError('Collection not found', {
        status: 404,
        code: 'COLLECTION_NOT_FOUND',
      });
    }
    return row;
  }

  async createCollection(
    input: Pick<Collection, 'name' | 'slug'>
  ): Promise<Collection> {
    const existing = await this.db
      .select()
      .from(collections)
      .where(eq(collections.slug, input.slug));
    if (existing.length > 0) {
      throw new AppError('Collection slug already exists', {
        status: 409,
        code: 'SLUG_EXISTS',
      });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const row = { id, ...input, createdAt: now, updatedAt: now };
    await this.db.insert(collections).values(row);
    return row;
  }

  async updateCollection(
    id: string,
    input: Partial<Pick<Collection, 'name' | 'slug'>>
  ): Promise<Collection> {
    const existing = await this.getCollection(id);

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await this.db
        .select()
        .from(collections)
        .where(eq(collections.slug, input.slug));
      if (slugTaken.length > 0) {
        throw new AppError('Collection slug already exists', {
          status: 409,
          code: 'SLUG_EXISTS',
        });
      }
    }

    const now = new Date().toISOString();
    await this.db
      .update(collections)
      .set({ ...input, updatedAt: now })
      .where(eq(collections.id, id));

    return { ...existing, ...input, updatedAt: now };
  }

  async deleteCollection(id: string): Promise<void> {
    await this.getCollection(id);

    const linkedEntries = await this.db
      .select()
      .from(entries)
      .where(eq(entries.collectionId, id));
    if (linkedEntries.length > 0) {
      throw new AppError('Cannot delete collection with existing entries', {
        status: 409,
        code: 'COLLECTION_NOT_EMPTY',
      });
    }

    await this.db.delete(collections).where(eq(collections.id, id));
  }

  // ── Entries ──────────────────────────────────────────────────

  async listEntries(collectionId?: string): Promise<Entry[]> {
    if (collectionId) {
      return this.db
        .select()
        .from(entries)
        .where(eq(entries.collectionId, collectionId));
    }
    return this.db.select().from(entries);
  }

  async getEntry(id: string): Promise<Entry> {
    const [row] = await this.db
      .select()
      .from(entries)
      .where(eq(entries.id, id));
    if (!row) {
      throw new AppError('Entry not found', {
        status: 404,
        code: 'ENTRY_NOT_FOUND',
      });
    }
    return row;
  }

  async createEntry(
    input: Pick<Entry, 'collectionId' | 'title' | 'slug' | 'body' | 'status'>
  ): Promise<Entry> {
    await this.getCollection(input.collectionId);

    const slugTaken = await this.db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.collectionId, input.collectionId),
          eq(entries.slug, input.slug)
        )
      );
    if (slugTaken.length > 0) {
      throw new AppError('Entry slug already exists in this collection', {
        status: 409,
        code: 'SLUG_EXISTS',
      });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const row = { id, ...input, createdAt: now, updatedAt: now };
    await this.db.insert(entries).values(row);
    return row;
  }

  async updateEntry(
    id: string,
    input: Partial<Pick<Entry, 'title' | 'slug' | 'body' | 'status'>>
  ): Promise<Entry> {
    const existing = await this.getEntry(id);

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await this.db
        .select()
        .from(entries)
        .where(
          and(
            eq(entries.collectionId, existing.collectionId),
            eq(entries.slug, input.slug)
          )
        );
      if (slugTaken.length > 0) {
        throw new AppError('Entry slug already exists in this collection', {
          status: 409,
          code: 'SLUG_EXISTS',
        });
      }
    }

    const now = new Date().toISOString();
    await this.db
      .update(entries)
      .set({ ...input, updatedAt: now })
      .where(eq(entries.id, id));

    return { ...existing, ...input, updatedAt: now };
  }

  async deleteEntry(id: string): Promise<void> {
    await this.getEntry(id);
    await this.db.delete(entries).where(eq(entries.id, id));
  }
}
