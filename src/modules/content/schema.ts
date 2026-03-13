import { z } from 'zod';

export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

export const entrySchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  title: z.string(),
  slug: z.string(),
  body: z.string().default(''),
  status: z.enum(['draft', 'published']).default('draft')
});

export type Collection = z.infer<typeof collectionSchema>;
export type Entry = z.infer<typeof entrySchema>;
