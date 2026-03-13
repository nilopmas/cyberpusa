import { z } from 'zod';

export const queueMessageSchema = z.object({
  type: z.enum(['content.published', 'content.unpublished', 'webhook.dispatch']),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime().optional()
});

export type QueueMessage = z.infer<typeof queueMessageSchema>;
