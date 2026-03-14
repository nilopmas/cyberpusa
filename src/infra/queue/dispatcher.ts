import { queueMessageSchema, type QueueMessage, type QueueMessageType } from './schema';
import { handleSessionCleanup, handleContentPublished, handleContentUnpublished } from './handlers';
import type { Env } from '../../core/config/env';

export async function dispatchQueueMessage(queue: Queue | undefined, input: QueueMessage): Promise<void> {
  const parsed = queueMessageSchema.parse(input);
  if (!queue) {
    console.warn('CMS_QUEUE binding not configured; skipping enqueue', parsed.type);
    return;
  }

  await queue.send({
    ...parsed,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
  });
}

export async function processQueueBatch(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      const body = message.body as { type?: QueueMessageType; payload?: Record<string, unknown> };
      const type = body?.type;
      const payload = body?.payload ?? {};

      switch (type) {
        case 'session.cleanup':
          if (env.CMS_DB) {
            await handleSessionCleanup(env.CMS_DB);
          }
          break;
        case 'content.published':
          await handleContentPublished(payload);
          break;
        case 'content.unpublished':
          await handleContentUnpublished(payload);
          break;
        default:
          console.log('Unhandled queue message type', type, message.id);
      }

      message.ack();
    } catch (err) {
      console.error('Queue message processing failed', message.id, err);
      message.retry();
    }
  }
}
