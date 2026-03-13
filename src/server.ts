import { createApp } from './core/http/app';
import { processQueueBatch } from './infra/queue/dispatcher';
import { RateLimiterDO } from './infra/rate-limit/rate-limiter-do';

const app = createApp();

export { RateLimiterDO };

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>): Promise<void> {
    // TODO: split by queue name when more queues are added.
    await processQueueBatch(batch);
  },
  async scheduled(controller: ScheduledController): Promise<void> {
    // TODO: add scheduled publish jobs / cleanup tasks.
    console.log('Scheduled trigger received', controller.cron);
  }
};
