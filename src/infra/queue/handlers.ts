import { drizzle } from 'drizzle-orm/d1';
import { lt } from 'drizzle-orm';
import { sessions } from '../db/schema/index';

/**
 * Deletes all sessions whose expires_at is in the past.
 * Returns the number of cleaned-up rows.
 */
export async function handleSessionCleanup(d1: D1Database): Promise<number> {
  const db = drizzle(d1);
  const now = new Date().toISOString();
  const expired = await db.select().from(sessions).where(lt(sessions.expiresAt, now));
  if (expired.length === 0) return 0;

  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  console.log(`session.cleanup: removed ${expired.length} expired session(s)`);
  return expired.length;
}

/**
 * Stub handler for content.published events.
 * In the future this could trigger cache warming, webhooks, etc.
 */
export async function handleContentPublished(payload: Record<string, unknown>): Promise<void> {
  console.log('content.published: processing', payload);
}

/**
 * Stub handler for content.unpublished events.
 */
export async function handleContentUnpublished(payload: Record<string, unknown>): Promise<void> {
  console.log('content.unpublished: processing', payload);
}
