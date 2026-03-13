# Cyberpusa Architecture

Cyberpusa follows a Workers-first layered design so every major component runs natively on Cloudflare.

## Layers

### 1) Runtime / Entry Layer
- `src/server.ts`
- Exposes Worker handlers: `fetch`, `queue`, `scheduled`
- Wires the app runtime and background processing stubs

### 2) Core Platform Layer
- `src/core/config/*` for env parsing/validation
- `src/core/http/*` for app setup, shared responses, and error mapping
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
2. Hono app validates bindings via `parseEnv`.
3. Routes delegate to domain service.
4. Responses use shared success/error wrappers for consistent API shape.

## Component Responsibilities
- **Hono App**: route composition + middleware + centralized error handling
- **Env Validator**: enforce required binding shape early
- **Infra Adapters**: isolate Cloudflare-specific API usage
- **Domain Services**: business logic for CMS features
- **Queue/Cron handlers**: async and scheduled workloads

## Next Build Steps
- Replace in-memory content service with D1 repositories
- Add auth + RBAC middleware for `/api/admin/*`
- Implement real Durable Object rate-limiting policy
- Add queue consumers for publish, webhook, and indexing pipelines
