# Cyberpusa Architecture

Cyberpusa follows a Workers-first layered design so every major component runs natively on Cloudflare.

## Layers

### 1) Runtime / Entry Layer
- `src/server.ts`
- Exposes Worker handlers: `fetch`, `queue`, `scheduled`
- Wires the app runtime and background processing stubs

### 2) Core Platform Layer
- `src/core/config/*` for env parsing/validation
- `src/core/http/*` for app setup, shared responses, error mapping, and request-id middleware
- Keeps request lifecycle conventions centralized

### 3) Infrastructure Adapters
- `src/infra/db/*` for D1 client + schema exports
- `src/infra/storage/*` for R2 integration
- `src/infra/cache/*` for KV-backed caching
- `src/infra/rate-limit/*` for Durable Object rate-limiter placeholder
- `src/infra/queue/*` for queue message contracts and dispatcher

### 4) CMS Domain Modules
- `src/modules/content/*`
- Route + service + schema skeleton for collection/entry operations
- Current implementation uses in-memory arrays as a temporary scaffold (TODO: D1 repositories)

## Request Flow
1. Worker receives request at `fetch`.
2. Request-ID middleware generates or reads `x-request-id`, sets it on the context, and logs request start/end.
3. Hono app validates bindings via `parseEnv`.
4. Routes delegate to domain service.
5. Responses use shared success/error wrappers for consistent API shape.

## Component Responsibilities
- **Hono App**: route composition + middleware + centralized error handling
- **Env Validator**: enforce required binding shape early
- **Infra Adapters**: isolate Cloudflare-specific API usage
- **Domain Services**: business logic for CMS features
- **Queue/Cron handlers**: async and scheduled workloads

## Phase 0 — Foundation Hardening

### Module Contracts
Each layer exports a barrel `index.ts` defining its public interface:
- `src/core/index.ts` — Env, AppError, response helpers, request-id middleware
- `src/infra/index.ts` — D1, KV, R2, queue, rate-limiter adapters
- `src/modules/index.ts` — content routes, service, schema types

Consumers should import from barrel files rather than reaching into internal paths.

### API Response Envelope
All responses follow a unified shape:
```json
{
  "success": true | false,
  "data": {},
  "error": { "code": "...", "message": "...", "details": {} },
  "meta": { "requestId": "..." }
}
```
- Success responses include `data` (and optional `meta`).
- Error responses include `error` with a machine-readable `code` and optional `details`.
- Error responses include `meta.requestId` for traceability.

### Request-ID & Logging
- Middleware reads `x-request-id` from the incoming request or generates a UUID.
- The ID is echoed back in the `x-request-id` response header.
- Structured JSON logs are emitted at request start and end with method, path, status, and duration.

### CI Pipeline
GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every PR and push to `main`:
1. `npm run typecheck` — TypeScript strict mode
2. `npm run test` — Vitest test suite

## Next Build Steps
- Replace in-memory content service with D1 repositories
- Add auth + RBAC middleware for `/api/admin/*`
- Implement real Durable Object rate-limiting policy
- Add queue consumers for publish, webhook, and indexing pipelines
