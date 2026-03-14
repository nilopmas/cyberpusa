import { z } from 'zod';

export const queueMessageType = z.enum([
  'content.published',
  'content.unpublished',
  'session.cleanup',
  'webhook.dispatch',
]);

export const queueMessageSchema = z.object({
  type: queueMessageType,
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime().optional(),
});

export type QueueMessage = z.infer<typeof queueMessageSchema>;
export type QueueMessageType = z.infer<typeof queueMessageType>;
