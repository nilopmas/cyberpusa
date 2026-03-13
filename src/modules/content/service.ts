import { AppError } from '../../core/http/errors';
import type { Collection, Entry } from './schema';

// TODO: replace in-memory state with D1 repositories.
const collections: Collection[] = [];
const entries: Entry[] = [];

export class ContentService {
  listCollections(): Collection[] {
    return collections;
  }

  createCollection(input: Pick<Collection, 'name' | 'slug'>): Collection {
    const exists = collections.some((c) => c.slug === input.slug);
    if (exists) throw new AppError('Collection slug already exists', { status: 409, code: 'COLLECTION_EXISTS' });

    const collection: Collection = { id: crypto.randomUUID(), ...input };
    collections.push(collection);
    return collection;
  }

  listEntries(collectionId?: string): Entry[] {
    if (!collectionId) return entries;
    return entries.filter((e) => e.collectionId === collectionId);
  }

  createEntry(input: Omit<Entry, 'id'>): Entry {
    const hasCollection = collections.some((c) => c.id === input.collectionId);
    if (!hasCollection) throw new AppError('Collection not found', { status: 404, code: 'COLLECTION_NOT_FOUND' });

    const entry: Entry = { id: crypto.randomUUID(), ...input };
    entries.push(entry);
    return entry;
  }
}
