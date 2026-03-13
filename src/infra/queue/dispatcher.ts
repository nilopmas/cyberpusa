import { queueMessageSchema, type QueueMessage } from './schema';

export async function dispatchQueueMessage(queue: Queue | undefined, input: QueueMessage): Promise<void> {
  const parsed = queueMessageSchema.parse(input);
  if (!queue) {
    // TODO: decide whether to hard-fail in production.
    console.warn('CMS_QUEUE binding not configured; skipping enqueue', parsed.type);
    return;
  }

  await queue.send({
    ...parsed,
    createdAt: parsed.createdAt ?? new Date().toISOString()
  });
}

export async function processQueueBatch(batch: MessageBatch<unknown>): Promise<void> {
  for (const message of batch.messages) {
    // TODO: route by message type to real handlers.
    console.log('Received queue message', message.id, message.body);
    message.ack();
  }
}
