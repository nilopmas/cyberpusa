import { z } from 'zod';

export const contentStatus = z.enum(['draft', 'published', 'scheduled']);
export type ContentStatus = z.infer<typeof contentStatus>;

export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const entrySchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  title: z.string(),
  slug: z.string(),
  body: z.string().default(''),
  status: contentStatus.default('draft'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Collection = z.infer<typeof collectionSchema>;
export type Entry = z.infer<typeof entrySchema>;
