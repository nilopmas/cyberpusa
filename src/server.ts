import { createApp } from './core/http/app';
import { processQueueBatch } from './infra/queue/dispatcher';
import { handleScheduled } from './infra/cron/scheduled';
import { RateLimiterDO } from './infra/rate-limit/rate-limiter-do';
import type { Env } from './core/config/env';

const app = createApp();

export { RateLimiterDO };

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await processQueueBatch(batch, env);
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await handleScheduled(controller, env);
  },
};
