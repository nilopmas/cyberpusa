import type { Env } from '../../core/config/env';

export function getD1(env: Env): D1Database {
  if (!env.CMS_DB) {
    throw new Error('CMS_DB binding is missing. Configure D1 in wrangler.jsonc.');
  }
  return env.CMS_DB;
}

// TODO: add repository factories and transactional helpers.
