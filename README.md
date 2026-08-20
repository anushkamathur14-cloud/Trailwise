# Trailwise

Trailwise is a tightly scoped product-analytics demo inspired by PostHog. It is **not** a warehouse, CDP, or full PostHog clone. It tells one story twice: a **Forge** SaaS website and an **Aurelia** wellness app, from event collection through analysis, recommendation, and an interactive journey preview.

## What the demo does

- Ingests product events (single, batch, identify, property updates)
- Resolves anonymous visitors, identified users, sessions, and identity merges
- Computes overview metrics, funnels, journey paths, retention, and behavioral signals from stored events
- Generates explainable product and next-best-action recommendations
- Lets a presenter act as a mock user in Experience Studio and watch events land in Live Activity

## Architecture

Next.js App Router (TypeScript) + Prisma/SQLite + React dashboard.

- `lib/ingestion` validation, redaction, duplicate `eventId` handling
- `lib/identity` person resolution, anonymous→known merge, 30-minute sessions, traits
- `lib/analytics` funnels, journeys, retention, overview queries
- `lib/signals` conversion-rate lift with sample thresholds and confidence intervals
- `lib/recommendations` deterministic rules engine
- `lib/ai` optional explanation rewrite; analytics never depend on an LLM
- `lib/studio` original vs recommended journey variants
- `app/api/*` ingest, identify, analytics, SSE live stream, health, reset

SQLite is the default so `npm run setup && npm run dev` is enough. The Prisma schema stays easy to point at PostgreSQL via `DATABASE_URL`.

## Local setup

```bash
npm install
cp .env.example .env
npm run setup    # prisma generate, db push, seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test         # unit + ingestion tests
npm run build    # production build
```

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` locally, Postgres URL in production |
| `SESSION_SECRET` | yes for UI-entered AI keys | Encrypts the httpOnly AI cookie |
| `AI_API_KEY` | no | Hosted default for explanation rewrite |
| `AI_BASE_URL` | no | Defaults to `https://api.openai.com/v1` |
| `AI_MODEL` | no | Defaults to `gpt-4o-mini` |

Never commit a real key. `.env` is gitignored.

## Database

```bash
npx prisma db push     # apply schema (SQLite or Postgres)
npm run db:seed        # deterministic seed, fixed seed 20260818
npm run db:reset       # wipe + reseed
```

In the UI: **Data sources → Reset demo data**.

Seeded volume: 520 Forge users and 520 Aurelia users, several weeks of activity, mixed success and failure paths.

## Tester Mode

1. Open **Experience Studio**.
2. Click **New anonymous tester**.
3. Interact with the Forge site or Aurelia phone preview.
4. Watch **Live activity** — events appear over SSE (with polling fallback).
5. **Identify tester** to merge anonymous → known (visible on the profile).
6. Open the tester profile, generate / inspect the recommendation, and **Preview recommended journey**.
7. Toggle Original vs Recommended and **A/B comparison**.

Other controls: introduce failure, complete conversion, simulate a returning user.

## How analytics are calculated

- **Activation / conversion** flags on each person from workspace goal events
- **Funnels** are ordered first-hits per person; drop-off is `1 - step_n / step_n-1`; median time is between consecutive matched steps
- **Journeys** collapse consecutive duplicate events, cap path length, and highlight the most converting path vs the most common failure path
- **Retention** is UTC calendar-day offsets from `firstSeenAt` (D1 / D7 / D30 plus a heatmap)
- **Signals** compare goal conversion with vs without the behavior. Lift = `(p_signal - p_baseline) / p_baseline`. Wilson-style intervals drive high/medium confidence. `n < 30` is low confidence. **Correlation is not causation.**

## How recommendations are generated

A rules-and-scoring engine in `lib/recommendations/engine.ts`. Product recs are fixed, evidence-linked playbooks per workspace. User recs inspect that person’s events (integration error, missing invite, early paywall, and so on) and return a preview id. No model is trained.

## Optional AI enhancement

Settings can store a provider key in an **httpOnly encrypted cookie**, or you can set `AI_API_KEY`. Calls go only through `app/api/recommendations` and `lib/ai/provider.ts`. Failures fall back to template copy. Rate limited. Keys are redacted from errors.

## Deployment

Repo: [anushkamathur14-cloud/Trailwise](https://github.com/anushkamathur14-cloud/Trailwise)

### Vercel (frontend + API)

SQLite on Vercel works for this demo via a bundled `prisma/demo.db` copied to `/tmp` on cold start.

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Set environment variables:
   - `SESSION_SECRET` — long random string (`openssl rand -base64 32`)
   - Optional: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`
   - Do **not** set `DATABASE_URL` unless you are using Postgres — the app defaults to the bundled SQLite demo DB on Vercel.
3. Build command is `npm run build` (generates Prisma client, prepares `demo.db`, then builds Next.js).
4. After deploy, open `/api/health` — you should see `"ok": true` with people/events counts.
5. For durable production data later, switch Prisma to `postgresql` and set `DATABASE_URL`.

Do not seed a real production database with demo people unless that is intentional.

## Privacy limitations

Consent is stored, properties are denylisted, obvious secrets are redacted, DNT is honored by the snippet, and a person can be deleted. This is still a **demo**: no legal DPA, no regional residency, no audit log, no cookie banner, no HIPAA/PCI handling. Never send real patient, payment, or credential data.

## Demo shortcuts vs production gaps

Shortcuts: SQLite, in-memory SSE bus (not multi-instance), synthetic users, deterministic recs, screen library instead of a visual editor, no real mobile binary, no warehouse, no feature flags service.

Production gaps: no Kafka/ClickHouse, no SSO, no organizations beyond two workspaces, no sampling at ingest, cookie-based AI keys are for demos only, serverless live streaming will not fan out across replicas.

## Five-minute demo script

1. Start on **Web Demo · Overview** — activation vs conversion, channels, events over time.
2. **Funnels** → activation, click a drop-off step.
3. **Journeys** — successful path vs integration-error failure path.
4. **Signals** — first-session integration lift; read the causation warning.
5. **Studio** — new tester, complete Forge until an error, recover on the recommended variant.
6. **Live activity** and the tester **Users** profile (identity merge + rec).
7. Switch workspace to **Mobile App Demo** and repeat with delayed paywall on Aurelia.
