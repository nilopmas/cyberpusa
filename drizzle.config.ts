import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infra/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // TODO: use Wrangler-managed D1 migrations for production.
    url: './migrations/local.db'
  }
});
