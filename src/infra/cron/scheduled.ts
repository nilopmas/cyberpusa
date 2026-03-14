import type { Env } from '../../core/config/env';
import { handleSessionCleanup } from '../queue/handlers';
import { KvCacheService, cacheKey } from '../cache/kv-service';

/**
 * Main cron entry point. Routes by cron expression to task handlers.
 */
export async function handleScheduled(controller: ScheduledController, env: Env): Promise<void> {
  console.log('Scheduled trigger received', controller.cron, new Date().toISOString());

  switch (controller.cron) {
    case '*/10 * * * *':
      // Every 10 minutes: clean up expired sessions.
      await runSessionCleanup(env);
      break;
    case '0 * * * *':
      // Every hour: warm the collections list cache.
      await runCacheWarm(env);
      break;
    default:
      // Run all maintenance tasks for unknown/catch-all cron.
      await runSessionCleanup(env);
      await runCacheWarm(env);
  }
}

async function runSessionCleanup(env: Env): Promise<void> {
  if (!env.CMS_DB) {
    console.warn('CMS_DB not available; skipping session cleanup');
    return;
  }
  const count = await handleSessionCleanup(env.CMS_DB);
  console.log(`cron session cleanup complete: ${count} expired session(s) removed`);
}

async function runCacheWarm(env: Env): Promise<void> {
  if (!env.CMS_DB || !env.CACHE_KV) {
    console.warn('CMS_DB or CACHE_KV not available; skipping cache warm');
    return;
  }

  // Pre-warm the collections list into cache.
  const { drizzle } = await import('drizzle-orm/d1');
  const { collections } = await import('../db/schema/index');
  const db = drizzle(env.CMS_DB);
  const rows = await db.select().from(collections);

  const cache = new KvCacheService(env);
  const key = cacheKey('http', '/api/public/content/collections', '');
  await cache.set(key, { status: 200, body: { success: true, data: rows } }, 600);
  console.log(`cron cache warm complete: ${rows.length} collection(s) cached`);
}
