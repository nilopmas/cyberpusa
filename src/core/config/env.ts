import { z } from 'zod';

const envSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),
  JWT_SECRET: z.string().min(8).optional(),
  CMS_DB: z.custom<D1Database>((v) => !!v, 'D1 binding is required').optional(),
  MEDIA_BUCKET: z.custom<R2Bucket>((v) => !!v, 'R2 binding is required').optional(),
  CACHE_KV: z.custom<KVNamespace>((v) => !!v, 'KV binding is required').optional(),
  RATE_LIMITER: z.custom<DurableObjectNamespace>((v) => !!v).optional(),
  CMS_QUEUE: z.custom<Queue>((v) => !!v).optional()
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: unknown): Env {
  return envSchema.parse(raw);
}
