# Cyberpusa

Cloudflare-native, headless CMS framework built for the Free Tier era.

> **Name style:** `Cyberpusa` (lowercase **p**)  
> Repo: `cyberpusa`

## Quickstart

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run deploy
```

## Vision

Cyberpusa is a **Workers-first CMS scaffold/framework** for building content systems that are:

- Cloudflare-native by design
- API-first and headless
- modular and reusable across products
- cost-aware for current and future Cloudflare Free Tier benefits

## Scope (v1)

Cyberpusa v1 focuses on a **headless CMS core** plus an **admin control plane served by Workers**.

### In Scope

- CMS APIs (`/api/*`)
- Admin control plane (`/admin/*`) served by Workers
- Content modeling and lifecycle
- Auth and role-based access control
- Media management
- Caching, rate limiting, and async jobs

### Out of Scope (v1)

- Public website theme engine
- Cloudflare Pages frontend
- Multi-tenant SaaS billing layer

## Cloudflare Services

Cyberpusa aims to leverage Cloudflare services as first-class building blocks:

1. **Workers** — runtime, routing, API, admin UI delivery
2. **D1** — relational content data store
3. **R2** — media/object storage
4. **KV** — cache and lightweight state/config
5. **Durable Objects** — distributed coordination and rate limiting
6. **Queues** — background event processing (email, webhook, indexing)
7. **Cron Triggers** — scheduled tasks (publish queue, cleanup)
8. **Workflows** *(optional in v1.5/v2)* — multi-step orchestration pipelines
9. **Turnstile** *(optional but recommended)* — bot protection for auth/admin routes

> Notes:
> - v1 is **Workers-only** (no Pages by design).
> - “Cloudflare Containers” are considered future/experimental and not core to v1.

## Core CMS Components

### 1) Content Engine
- Collections / content types
- Field schemas + validation
- Slugs, metadata, status

### 2) Content Lifecycle
- Draft / Published / Scheduled
- Versioning hooks (v1 minimal)
- Publish/unpublish workflows

### 3) Auth & RBAC
- Users, sessions, roles
- Permission checks for admin/content operations
- Secure admin-only route guards

### 4) Media Module
- Upload pipeline to R2
- Media metadata in D1
- Delivery endpoints and cache headers

### 5) API Surface
- Public content read routes
- Admin write routes
- Structured errors + typed responses

### 6) Performance & Security
- KV + edge cache strategy
- Durable Object rate limiter
- Optional Turnstile protection

### 7) Async Processing
- Queue-based background workers
- Scheduled jobs via Cron
- Optional Workflows for long-running orchestration

## Route Layout

### Public (read-only)
- `GET /api/public/content/collections` — list collections
- `GET /api/public/content/collections/:id` — get collection
- `GET /api/public/content/entries` — list entries (optional `?collectionId` filter)
- `GET /api/public/content/entries/:id` — get entry

### Admin (mutations)
- `POST /api/admin/content/collections` — create collection
- `PUT  /api/admin/content/collections/:id` — update collection
- `DELETE /api/admin/content/collections/:id` — delete collection
- `POST /api/admin/content/entries` — create entry
- `PUT  /api/admin/content/entries/:id` — update entry
- `DELETE /api/admin/content/entries/:id` — delete entry

### Other
- `GET /healthz` — health check
- `GET /admin` — admin control plane placeholder

## Architecture Direction

Cyberpusa follows a layered architecture:

- **Core Platform Layer**: runtime, routing, auth, env, logging, errors
- **Infrastructure Layer**: D1, R2, KV, DO, Queue adapters
- **CMS Domain Layer**: content, media, taxonomy, workflow logic
- **Presentation Layer**: admin UI served from Workers

## MVP Milestones

### Phase 0 — Foundation (done)
- Worker app skeleton, env validation, CI pipeline
- API envelope, request-id, structured logging

### Phase 1 — CMS Core MVP (done)
- D1-backed collections and entries CRUD via drizzle-orm
- Status lifecycle: draft / published / scheduled
- Slug uniqueness at DB + service layer
- 24 tests covering happy paths and key error cases

### Phase 2 — Ops Hardening
- Auth + RBAC middleware for `/api/admin/*`
- KV caching, DO rate limiting
- Queue consumers + cron jobs

### Phase 3 — Admin Plane
- `/admin` control UI in Worker
- Media upload + retrieval
- Content editor workflow

## Why This Project

Most CMS options are either:
- not Cloudflare-native, or
- tied to a specific product shape.

Cyberpusa aims to be a **Cloudflare-native CMS foundation** you can evolve into blog/docs/knowledge-base/product-content systems without changing the core stack.

---

If you’re building on Cloudflare and want a practical, composable CMS baseline, Cyberpusa is for you.
