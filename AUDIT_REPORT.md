# HMO Hunter — Pre-Production Audit

**Date:** 2026-09-02
**Auditor:** Claude Opus 5 (lead engineer role)
**Commit audited:** `d011b65` on branch `purchase-only-ingest` (2 commits ahead of `main` @ `5c78df6`)
**Production:** https://hmohunter.co.uk (Vercel project `hmo-hunter-app`)

## Scope note — read this first

The working tree contained **uncommitted changes made earlier in this same session**, before the
audit was commissioned. They are excluded from the findings below and listed here so nothing is
misattributed:

| File | Change | Status |
|---|---|---|
| `app/api/enrich-rents/route.ts` | removed the `price_pcm` write | uncommitted |
| `tests/no-fabrication.test.ts` | replaced the assertion pinning the old guard | uncommitted |

Also from this session, and reflected in the numbers below: 1,632 Zoopla rental rows, 52 `SeedData`
rows and 216 computed rents were deleted/cleared from the production database. The table went
**2,593 → 909 rows**. Backups are at `~/hmo-hunter-rentals-backup-2026-09-02.json`,
`~/hmo-hunter-seeddata-backup-2026-09-02.json`, `~/hmo-hunter-register-rents-cleared-2026-09-02.json`.

**No source file was modified during the audit itself.** This report is the only artefact produced.

---

## Verdict

**Not production-ready.** Three independent Blocker classes:

1. **26 API routes have no authentication.** 11 write to the database, 2 delete. Proven callable
   against production with `curl`, no credentials, no cookies.
2. **The property detail page renders two fabricated financial figures** — a "Net Yield" that is
   `gross × 0.7` and a "Cashflow" built on hardcoded 30% costs, 75% LTV and 5.5% interest. These are
   the exact figures PR #26 removed from a sibling component; the duplicate was missed.
3. **8 database tables that live routes query do not exist in production.** Those endpoints 500.

The codebase is *not* careless — it carries unusually good provenance discipline (a
`no-fabrication` test suite, honest 503s for unconfigured sources, well-reasoned comments on
tricky decisions). The failures are concentrated where that discipline was applied to one call
site and not its duplicate, or where a guard was added to one route prefix and not the rest.

---

## Summary

| Phase | Result |
|---|---|
| 1 — Map | 17 pages, 76 API routes, 21 live tables, 12 external data APIs, 5 cron jobs |
| 2 — Provenance | 2 fabricated user-facing figures live; 1 inverted status scale; 35/41 external-fetch files have no timeout |
| 3 — Static | `tsc` 2 errors (both Stripe); ESLint **22 errors, 230 warnings**; ~2,630 lines dead components |
| 4 — Tests/Build | 1,199 tests pass (42 files); production build **succeeds but skips type validation** |
| 5 — Runtime/Env | 8 tables missing; 11 of 11 migrations unapplied or partial; `properties` has no `CREATE TABLE` in repo |
| 6 — Security | 26 unguarded routes; CSRF bypassable; rate limiting non-functional; 35 npm vulns (2 critical, 16 high) |

**Findings: 9 Blocker · 14 High · 11 Medium · 7 Low**

---

## Findings

### BLOCKER

| # | File : line | Finding | Evidence |
|---|---|---|---|
| B1 | `components/hero-metrics-bar.tsx:70` | **"Net Yield" is fabricated.** `netYield = grossYield * 0.7` — a flat 30% haircut presented to the user as a net yield, with a colour-coded status. No disclosure. | Rendered at line 114 as `label: "Net Yield"`. Component is live: imported and rendered by `components/property-detail-page.tsx:33,382`. PR #26 removed this exact formula from `property-detail-card.tsx`; the duplicate here was missed. |
| B2 | `components/hero-metrics-bar.tsx:72-78` | **"Cashflow" is fabricated.** `costs = annualRent * 0.3`; `mortgage = purchase_price * 0.75 * 0.055`. Hardcoded cost ratio, LTV and interest rate, none disclosed, rendered as a signed £ figure with a traffic light. The rent it starts from is itself modelled (`estimated_rent_per_room × bedrooms`, line 61-63). | Rendered at line 118-123. Same removal history as B1. 5.5% is also a stale rate. |
| B3 | `app/api/refresh-data/route.ts:12` | **Unauthenticated destructive endpoint.** `POST` with no auth guard of any kind deletes from `properties` (line 35-38) then triggers a full ingestion. | No `requireAdmin`, no session check, no cron secret. `middleware.ts:77` explicitly exempts `/api/*` from the auth redirect. |
| B4 | `app/api/article4/sync-registry/route.ts` | **Unauthenticated destructive endpoint** on the Article 4 registry — the product's accuracy centrepiece. `GET,POST`, writes and deletes. | Same absence of guards. `article4_councils` (337 rows) and `article4_directions` (62 rows) are rewritable by anyone. |
| B5 | `lib/csrf.ts:54-55` | **CSRF protection is bypassable by omission.** `if (!cookieToken) return null` — any client that sends no cookie skips validation entirely. Every non-browser client does this by default. | Proven: `curl -X POST` with no cookies to `/api/kamma-check` on production returned **400 "Postcode is required"** — a validation error from inside the handler, not 401 or 403. |
| B6 | 26 routes (see Appendix B) | **No authentication on 26 of 76 API routes**; 11 write, 2 delete. Includes `setup-database`, `run-ingestion`, `ingest-zoopla`, `geocode-properties`, `scrape-council-hmo`, `planning/ingest-hmo`, `sync-zoopla-images`, `analyze-properties`, `analyze-potential-hmos`, `info-request`, `gdpr/data-request`. | `lib/admin-auth.ts` was written because enrich routes were publicly writable. The fix covered the `/api/enrich-*` prefix only; the same class of route outside it was never covered. |
| B7 | live DB vs `app/api/*` | **8 tables queried by live routes do not exist in production**: `off_market_leads`, `pipeline_deals`, `pipeline_labels`, `pipeline_stage_config`, `property_viewings`, `d2v_templates`, `d2v_campaigns`, `broadband_coverage`. | PostgREST: `Could not find the table 'public.<name>' in the schema cache`. Breaks `/api/off-market{,/leads,/ingest}`, `/api/pipeline`, `/api/viewings`, `/api/d2v/{templates,campaigns}`, `/api/enrich-broadband`. |
| B8 | `app/api/map-data/route.ts` | **The paid product's core data is served unauthenticated.** `GET /api/map-data` returns full property records including coordinates to anyone. | Proven against production: `HTTP 200`, 175 London properties with lat/lng, no credentials. Owner/contact gating in `lib/entitlements.ts` is bypassed entirely by this route. |
| B9 | `next.config.mjs:5-7` | **Type errors ship to production.** `typescript: { ignoreBuildErrors: true }`. The build log confirms `Skipping validation of types`. Two known type errors exist today; any future one deploys silently. | `npx tsc --noEmit` → 2 errors. `next build` → succeeds regardless. |

### HIGH

| # | File : line | Finding | Evidence |
|---|---|---|---|
| H1 | `components/hero-metrics-bar.tsx:34-39` | **`getRentPerRoomStatus` is inverted.** `< £400` renders green ("positive"), `> £600` renders red ("negative"). For an investor, higher room rent is better income. It mirrors `getPricePerRoomStatus` (lines 27-32), where lower genuinely is better — a copy-paste that was not flipped. | A £700/room property displays as bad; a £350/room property as good. |
| H2 | `lib/rate-limit.ts:53-55` | **Rate limiting is non-functional in production and its docstring says otherwise.** The comment claims "Uses Upstash Redis when configured, falls back to in-memory"; the function body never touches Redis. `lib/redis.ts` is imported by **no file** — only mentioned in comments. | In-memory `Map` per serverless instance; Vercel instances are ephemeral and horizontally scaled. |
| H3 | `app/api/enrich-property-images/route.ts:5`, `app/api/zoopla-images/route.ts:7` | **Hardcoded API credential committed to source.** `process.env.ZOOPLA_API_KEY \|\| "eec9ejtet7bzzgduvjlkj1b8"` | Present in git history. Should be revoked regardless of whether it still works. |
| H4 | production database | **A Google Maps API key is stored in 161 property rows** and served to every browser that renders them, inside `images[]` Street View URLs. | Key `AIzaSyBUk7nU…` embedded in stored URLs. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is not set in any environment, so this key is unmanaged. |
| H5 | `package.json` | **`vitest`, `jsdom`, `@vitejs/plugin-react` are in `dependencies`**, not `devDependencies` — they are installed in production. `vitest` currently carries a **CRITICAL** advisory. | `npm audit`: *"When Vitest UI server is listening, arbitrary file can be read and executed"*. |
| H6 | `package.json` | **`jspdf` has a CRITICAL advisory** (PDF Object Injection via `addJS`) and powers a live user-facing route. | `/api/export/pdf` is a shipped feature. |
| H7 | `npm audit` | **35 vulnerabilities: 2 critical, 16 high, 15 moderate, 2 low.** Includes `next` (HTTP request smuggling in rewrites), `lodash` (code injection), `serialize-javascript` (RCE). | Full list in Appendix C. |
| H8 | 35 of 41 files | **No timeout on external API calls.** 35 of the 41 files that `fetch()` an external HTTPS URL have no `AbortSignal`/`AbortController`. A hung upstream holds a serverless function to its `maxDuration` (300s on some routes). | Only `fetch-real-hmo-data`, `scrape-council-hmo`, `article4/coverage`, `article4/registry`, `epc-non-domestic`, `planning/planit` set one. |
| H9 | `app/api/admin/set-premium/route.ts:42-45` | **Legacy endpoint writes a retired auth signal.** Sets `user_metadata.is_premium`, the flag migration 018 replaced with tiers. Reintroduces the double-gate the tier work removed. Also uses `!==` on a secret rather than the constant-time compare in `lib/admin-auth.ts`. | `lib/entitlements.ts` is documented as the single source of truth. |
| H10 | `components/map-inner.tsx:54,81` | **`Cannot access variable before it is declared`** — ESLint error in the live map component (dynamically imported by `main-map-view.tsx:45`). | Potential runtime TDZ error on the primary screen. |
| H11 | `components/saved-searches.tsx:135` | **Unreachable branch** — `no-dupe-else-if`: "This branch can never execute. Its condition is a duplicate or covered by previous conditions." | Live component; a saved-search condition silently never fires. |
| H12 | `components/owner-information-section.tsx:284` | **`Cannot create components during render`** — ESLint error in a live component that renders the paid tier's headline feature. | Remounts subtree each render; state loss and performance risk. |
| H13 | `supabase/migrations/` | **The database cannot be rebuilt from the repo.** `properties` (184 columns, the core table) has **no `CREATE TABLE`** anywhere. 15 of 21 live tables are absent from migrations; conversely 8 tables in migrations do not exist in production. Migrations are unnumbered, so ordering is undefined. | Live schema fetched from PostgREST vs `grep CREATE TABLE supabase/migrations/*.sql`. |
| H14 | `app/api/payments/route.ts:17-21` | **Payments sell a retired product.** Three credit packs (£9.99/£24.99/£49.99) writing to `user_credits`, under an entitlement model that replaced credits with free/pro/admin tiers. `stripe` is not installed, so the route also cannot execute. | Build: `Module not found: Can't resolve 'stripe'` ×2. `credit_adjustments` table: 0 rows. |

### MEDIUM

| # | File : line | Finding |
|---|---|---|
| M1 | `components/hero-metrics-bar.tsx:13-18` | `getYieldStatus` fires "positive" at ≥6%, but is fed `netYield` (already ×0.7). Median gross across the table is ~3%, so the green state is effectively unreachable. PR #26 removed this threshold from the sibling component for the same reason. |
| M2 | `lib/config/api-config.ts` | **`enabled` is derived from key presence, not reachability** (`!!process.env.X`). Verified live: PropertyData, PaTMa and StreetData all report `enabled: true` while their accounts are dead (403/403/401). Any status UI built on `getApiStatus()` would report dead integrations as connected. |
| M3 | `lib/config/api-config.ts:132-137` | **Ofcom is a phantom integration.** `OFCOM_API_KEY` gates an integration that has no API — `/api/enrich-broadband` reads a 48 MB local CSV from `data/ofcom/`, which is `.gitignore`d and therefore never deployed. The status board would report "not configured" against a column that is 100% populated, and the pipeline cannot run on Vercel at all. |
| M4 | `lib/config/api-config.ts:118-126` | **EPC base URL is stale.** `https://epc.opendatacommunities.org/api/v1` now 301s to `get-energy-performance-data.communities.gov.uk`, where the same path 404s. The integration cannot work regardless of credentials. |
| M5 | `app/api/setup-database/route.ts`, `app/api/run-migration/route.ts` | Schema-mutating endpoints exposed over HTTP. `run-migration` at least requires the admin key; `setup-database` has **no guard**. Neither belongs in a deployed application. |
| M6 | `app/debug-map/page.tsx` | A debug page is built and deployed to production (confirmed in the build manifest as a static route). |
| M7 | 10 components, ~2,630 lines | **Dead components** still built and shipped: `d2v-composer` (740), `pipeline-board` (554), `viewing-tracker` (460), `key-flags-row` (141), `licence-expiry-warning` (156), `property-map` (124), `potential-hmo-badge` (106), `epc-floor-area-badge` (211), `floor-plan-badge` (77), `freshness-badge` (61). Confirmed unreferenced. |
| M8 | `components/property-map.tsx` + `public/data/article4-areas.geojson` | A **hand-drawn 28-feature GeoJSON** of Article 4 areas with `effective_date: "Various (2018-2021)"` would paint approximate planning boundaries as fact. Currently harmless **only because the component is dead** (M7). It must not be revived. |
| M9 | `lib/services/dashboard-insights.ts`, `lib/ingestion/enrichment/ofcom-broadband.ts` | Dead modules (63 + 239 lines), confirmed unreferenced. |
| M10 | `lib/config/api-config.ts:183` | `USE_MOCK_DATA` is read only for validation messaging and never gates any data path. An operator setting it would see warnings but no behaviour change — a control that does nothing. |
| M11 | ESLint | **22 errors, 230 warnings** with zero suppressions configured. 177 warnings are `no-unused-vars`, 27 `no-img-element`, 18 `react-hooks/exhaustive-deps`. Full list in Appendix D. |

### LOW

| # | Finding |
|---|---|
| L1 | `package.json` name is still `my-v0-project` — the scaffold default. |
| L2 | Next 16 deprecation: *"The `middleware` file convention is deprecated. Please use `proxy` instead."* |
| L3 | Two `@sentry/nextjs` deprecation warnings on every build (`disableLogger`, `reactComponentAnnotation`). |
| L4 | `@types/stripe` is in devDependencies; `stripe` ships its own types and this package is deprecated. |
| L5 | `app/api/enrich-rents/route.ts:244` documented `purchase_price: "Estimated purchase price (if not set) based on ~7% yield"` — behaviour the code no longer performs. *(Corrected in this session's uncommitted change.)* |
| L6 | `lib/ingestion/adapters/rightmove.ts:322` — `no-useless-escape` ESLint error. |
| L7 | `lib/report/hmo-check.ts:533-534` — `react-hooks/rules-of-hooks` errors from a non-hook function named `useAndConversionSection`. Naming collision, not a real hook violation, but it masks genuine rule-of-hooks errors in the same report. |

---

## Data provenance map

Chain per user-facing field. **Bold = defect.**

### Property detail page (`/property/[id]` → `property-detail-page.tsx`)

| Field | Chain | Verdict |
|---|---|---|
| Address, postcode, beds | `properties` ← Zoopla/PropertyData ingest | Observed |
| Asking price | `properties.purchase_price` ← Zoopla listing | Observed |
| **"Net Yield"** | `hero-metrics-bar:70` = `((est_rent_per_room × beds × 12) / purchase_price × 100) × 0.7` | **Fabricated — the ×0.7 has no source** |
| **"Cashflow"** | `hero-metrics-bar:72-78` = `(annualRent − annualRent×0.3 − price×0.75×0.055) / 12` | **Fabricated — 3 undisclosed constants** |
| Price/Room | `purchase_price / bedrooms` | Derived, sound |
| Rent/Room | `price_pcm / bedrooms` | Derived, sound — **but status scale inverted (H1)** |
| Gross yield (card) | `property-detail-card:164` with basis printed on the face | Derived, disclosed — correct pattern |
| EPC rating | `properties.epc_rating` ← EPC API (65.2% coverage) | Observed, **stale: source API has moved (M4)** |
| Broadband | `properties.broadband_*` ← local Ofcom CSV (100%) | Observed, **not reproducible in prod (M3)** |
| Article 4 status | `properties.article_4_status` ← `article4_directions` (62 rows) | Observed, three-state, sound |
| Owner / directors | `properties.owner_name`, `.directors` ← Searchland + Companies House | Observed but **7.1% / 1.1% coverage**; absent renders as nothing |
| Agent contact | `properties.agent_name` ← Apify | **0.3% coverage**; panel returns `null` — feature invisible |
| Sold history | `/api/sold-prices` ← Zoopla | **Honest 503 when unconfigured — correct pattern** |
| Planning decisions | `hmo_planning_decisions` (994 rows) ← PlanIt | Observed, well-built, has run |

### Silent-absence pattern (Medium, systemic)

`agent-contact-card.tsx:316`, `owner-information-section.tsx:127`, `sold-price-history.tsx:113/132/136`
and `broadband-badge.tsx:101` all `return null` when their column is empty. Nothing breaks, but the
feature is invisible and indistinguishable from "this property has no agent". Against a table where
agent coverage is 0.3%, this hides a missing integration as if it were a property attribute.

### External API resilience

| Concern | State |
|---|---|
| Timeouts | **35 of 41 files have none (H8)** |
| Retry/backoff | Only `planit.ts`, `enrich-owner`, `enrich-broadband`, `enrich-streetdata` |
| Auth expiry / dead account | **Not detected — `enabled` checks key presence only (M2)** |
| Empty/partial response | Mixed. Zoopla routes fail honestly (503). Others return `[]` silently — **53 catch blocks return an empty/default value** |
| Rate limits | Handled in `planit.ts` only |

---

## What would show wrong or fake data in production

1. **"Net Yield" on every purchase property** — `gross × 0.7`, no basis (B1).
2. **"Cashflow" on every purchase property** — three undisclosed hardcoded constants (B2).
3. **Rent-per-room traffic light, inverted** — good properties show red (H1).
4. **Any status UI built on `getApiStatus()`** — would report three dead accounts as connected (M2), and Ofcom as disconnected against a 100%-populated column (M3).
5. **EPC data presented as current** — the source API has moved; the stored values are frozen and cannot refresh (M4).
6. **Article 4 GeoJSON overlay** — approximate hand-drawn boundaries as fact, if `property-map.tsx` is ever revived (M8).
7. **Agent/owner panels vanishing** rather than declaring the integration absent — reads as a property attribute, not a gap.

## What would crash or fail in production

1. `/api/off-market`, `/api/off-market/leads`, `/api/off-market/ingest` → `off_market_leads` missing (B7).
2. `/api/pipeline` → `pipeline_deals`, `pipeline_labels`, `pipeline_stage_config` missing (B7).
3. `/api/viewings` → `property_viewings` missing (B7).
4. `/api/d2v/templates`, `/api/d2v/campaigns` → tables missing (B7).
5. `/api/enrich-broadband` → `broadband_coverage` missing, **and** the CSV it reads is gitignored (B7/M3).
6. `/api/payments` (POST) → `Module not found: 'stripe'` the moment `STRIPE_SECRET_KEY` is set (H14).
7. `/api/enrich-{propertydata,patma,streetdata}` → upstream 403/403/401, dead accounts (M2).
8. `/api/enrich-epc` → upstream moved, 404 (M4).
9. Any hung upstream → function held to `maxDuration`, up to 300s (H8).
10. `components/map-inner.tsx` → possible TDZ error on the primary screen (H10).

## Untested code paths touching data or money

- `/api/payments` and `/api/payments/webhook` — **no tests, cannot even build**.
- All 26 unguarded routes — no auth tests exist because there is no auth to test.
- `hero-metrics-bar.tsx` — **no test covers the two fabricated figures**. `no-fabrication.test.ts` performs static source checks on `enrich-rents` but never asserts on this component.
- The 8 routes querying missing tables — no integration test would have caught this, as tests do not touch those tables.

---

## Prioritised fix plan

### P0 — before any production traffic

1. **Delete "Net Yield" and "Cashflow" from `hero-metrics-bar.tsx`** (B1, B2). PR #26 already established the pattern in `property-detail-card.tsx`: show one figure, with its basis on its face. Add a test asserting neither label can return.
2. **Add auth to all 26 unguarded routes** (B6). Public reads (`map-data`, `article4-data`, `hmo-check`, `sold-prices`, `area-stats`) need an explicit decision, not an omission — `map-data` in particular currently gives away the paid dataset (B8).
3. **Fix CSRF** (B5) — a missing cookie must fail, not skip.
4. **Delete `setup-database`, `run-migration`, `refresh-data`, `debug-map`** (B3, M5, M6).
5. **Either create the 8 missing tables or delete the 9 routes that query them** (B7). Given `d2v-composer`, `pipeline-board` and `viewing-tracker` are dead UI (M7), deletion is the cheaper and more honest answer.
6. **Revoke the two exposed credentials** (H3, H4): the committed Zoopla key, and the Google Maps key embedded in 161 rows.

### P1 — before onboarding real users

7. Fix the inverted rent-per-room scale (H1).
8. Make rate limiting real, or delete `lib/redis.ts` and stop claiming it (H2).
9. Move `vitest`/`jsdom`/`@vitejs/plugin-react` to devDependencies (H5); upgrade `jspdf` (H6); triage the 16 high advisories (H7).
10. Add timeouts to all external `fetch()` calls (H8).
11. Turn off `ignoreBuildErrors` and fix the 2 type errors (B9).
12. Reconcile migrations with the live schema; get `CREATE TABLE properties` into the repo (H13).

### P2 — correctness debt

13. Make `enabled` a reachability probe, not a key-presence check (M2).
14. Resolve Ofcom (M3) and EPC (M4) — both are currently fictions in the config.
15. Delete the ~2,630 lines of dead components and the stale GeoJSON (M7, M8, M9).
16. Replace silent `return null` with a stated absence.
17. Clear the 22 ESLint errors (M11); H10/H11/H12 are among them and are real bugs.

---

## Appendix A — What is genuinely well built

Recorded because an audit that lists only faults misrepresents the codebase.

- `lib/planning/planit.ts` — pagination, retries, backoff, rate-limit handling, and an explicit
  written analysis of redistribution licensing. 994 rows ingested. Best module in the repo.
- `tests/no-fabrication.test.ts` — enforces the provenance rule statically across four roots.
- The Zoopla 503 pattern (`ingest-zoopla`, `sold-prices`, `area-stats`, `sync-zoopla-images`) —
  distinguishes "not connected" from "the market has none". This is the pattern the rest of the
  codebase should adopt.
- `lib/admin-auth.ts` — fails closed, constant-time compare, and says why in the comment.
- `lib/entitlements.ts` — capabilities and limits kept as separate ideas, 32 tests.
- `lib/properties/location.ts` — coordinate catchments with corner-trimming, replacing string matching.
- `propertydata-hmo.ts` `stableId` — derives the dedupe key from postcode + address, and the comment
  explains exactly which bug it prevents. Verified correct against live API responses during this audit.
- 1,199 tests across 42 files, all passing.

---

## Appendix B — Authentication map (76 routes)

```
  admin/set-premium/route.ts                            ***NONE***
  admin/users/[userId]/status/route.ts                  SESSION ROLE_ADMIN ENTITLEMENT
  admin/users/[userId]/tier/route.ts                    SESSION ROLE_ADMIN ENTITLEMENT
  admin/users/route.ts                                  SESSION ROLE_ADMIN ENTITLEMENT
  analyze-potential-hmos/route.ts                       ***NONE***
  analyze-properties/route.ts                           ***NONE***
  area-stats/route.ts                                   ***NONE***
  article4-data/route.ts                                ***NONE***
  article4/council/[slug]/route.ts                      ***NONE***
  article4/sync-registry/route.ts                       ***NONE***
  broadband-lookup/route.ts                             ***NONE***
  cron/detect-stale/route.ts                            CRON_SECRET
  cron/ingest-off-market/route.ts                       CRON_SECRET
  cron/refresh-data/route.ts                            CRON_SECRET
  d2v/campaigns/route.ts                                SESSION
  d2v/templates/route.ts                                SESSION
  dashboard/route.ts                                    SESSION
  data-coverage/route.ts                                SESSION ROLE_ADMIN ENTITLEMENT
  enrich-all-images/route.ts                            ADMIN_KEY
  enrich-all/route.ts                                   ADMIN_KEY
  enrich-article4/route.ts                              ADMIN_KEY
  enrich-batch/route.ts                                 ADMIN_KEY
  enrich-broadband/route.ts                             ADMIN_KEY
  enrich-companies/route.ts                             ADMIN_KEY
  enrich-epc/route.ts                                   ADMIN_KEY
  enrich-floor-area/route.ts                            ADMIN_KEY
  enrich-floor-plans/route.ts                           ADMIN_KEY
  enrich-hmo-licence/route.ts                           ADMIN_KEY
  enrich-images/route.ts                                ADMIN_KEY
  enrich-landregistry/route.ts                          ADMIN_KEY
  enrich-owner/route.ts                                 ADMIN_KEY
  enrich-patma/route.ts                                 ADMIN_KEY
  enrich-potential-hmos/route.ts                        ADMIN_KEY
  enrich-property-images/route.ts                       ADMIN_KEY
  enrich-propertydata/route.ts                          ADMIN_KEY
  enrich-rents/route.ts                                 ADMIN_KEY
  enrich-streetdata/route.ts                            ADMIN_KEY
  enrich-zoopla/route.ts                                ADMIN_KEY
  entitlements/route.ts                                 SESSION ENTITLEMENT
  export/pdf/route.ts                                   SESSION ENTITLEMENT
  export/route.ts                                       SESSION ENTITLEMENT
  fetch-real-hmo-data/route.ts                          ***NONE***
  gdpr/data-request/route.ts                            ***NONE***
  gdpr/log-access/route.ts                              SESSION
  geocode-properties/route.ts                           ***NONE***
  hmo-check/route.ts                                    ***NONE***
  image-stats/route.ts                                  ***NONE***
  info-request/route.ts                                 ***NONE***
  ingest-zoopla/route.ts                                ***NONE***
  intelligence/route.ts                                 ***NONE***
  kamma-check/route.ts                                  ***NONE***
  licences/route.ts                                     SESSION ROLE_ADMIN ENTITLEMENT
  map-data/route.ts                                     ***NONE***
  off-market/ingest/route.ts                            ADMIN_KEY
  off-market/leads/route.ts                             SESSION
  off-market/route.ts                                   SESSION
  payments/route.ts                                     SESSION
  payments/webhook/route.ts                             ***NONE***
  pipeline/route.ts                                     SESSION
  planning/hmo-decisions/route.ts                       ***NONE***
  planning/ingest-hmo/route.ts                          ***NONE***
  price-alerts/route.ts                                 SESSION ENTITLEMENT
  property/[id]/route.ts                                SESSION
  refresh-data/route.ts                                 ***NONE***
  run-ingestion/route.ts                                ***NONE***
  run-migration/route.ts                                ADMIN_KEY
  saved-searches/route.ts                               SESSION ENTITLEMENT
  scrape-council-hmo/route.ts                           ***NONE***
  send-notifications/route.ts                           CRON_SECRET
  setup-database/route.ts                               ***NONE***
  sold-prices/route.ts                                  ***NONE***
  sync-zoopla-images/route.ts                           ***NONE***
  track-contact/route.ts                                SESSION ENTITLEMENT
  track-property-view/route.ts                          SESSION ENTITLEMENT
  viewings/route.ts                                     SESSION
  zoopla-images/route.ts                                ***NONE***
```

### Unguarded routes, with write capability

```
  analyze-potential-hmos/route.ts                [POST,GET] WRITES
  analyze-properties/route.ts                    [POST,GET] WRITES
  area-stats/route.ts                            [GET] 
  article4-data/route.ts                         [GET] 
  article4/council/[slug]/route.ts               [GET] 
  article4/sync-registry/route.ts                [GET,POST] WRITES DELETES
  broadband-lookup/route.ts                      [GET,POST] 
  fetch-real-hmo-data/route.ts                   [POST,GET] 
  gdpr/data-request/route.ts                     [POST,GET] WRITES
  geocode-properties/route.ts                    [POST,GET] WRITES
  hmo-check/route.ts                             [GET] 
  image-stats/route.ts                           [GET] 
  info-request/route.ts                          [POST,GET] WRITES
  ingest-zoopla/route.ts                         [POST,GET] WRITES
  intelligence/route.ts                          [GET,POST] 
  kamma-check/route.ts                           [POST,GET] 
  map-data/route.ts                              [GET] 
  planning/hmo-decisions/route.ts                [GET] 
  planning/ingest-hmo/route.ts                   [GET,POST] WRITES
  refresh-data/route.ts                          [POST,GET] WRITES DELETES
  run-ingestion/route.ts                         [POST,GET] 
  scrape-council-hmo/route.ts                    [POST,GET] WRITES
  setup-database/route.ts                        [POST,GET] WRITES
  sold-prices/route.ts                           [GET] 
  sync-zoopla-images/route.ts                    [POST] WRITES
  zoopla-images/route.ts                         [GET] 
```

## Appendix C — Environment variables

`LOCAL` = present in `.env.local`. Production (Vercel) holds only: Supabase/Postgres cluster,
`NEXT_PUBLIC_STADIA_API_KEY`, `PROPERTYDATA_*`, `STREETDATA_*`, `PATMA_*`, `ADMIN_API_KEY`, `EPC_API_KEY`.
`CRON_SECRET` was deliberately removed this session (it armed `detect-stale`, which would have
marked all visible properties stale against a 14-day threshold on 7-month-old data).

```
  ADMIN_API_KEY                          LOCAL  app/api/admin/set-premium/route.ts lib/admin-auth.ts 
  APIFY_API_TOKEN                        -----  app/actions/listing-matcher.ts app/api/enrich-floor-plans/route.ts lib
  COMPANIES_HOUSE_API_KEY                -----  lib/config/api-config.ts 
  CRON_SECRET                            LOCAL  app/api/send-notifications/route.ts app/api/cron/ingest-off-market/rou
  EMAIL_FROM                             -----  lib/email/resend.ts 
  EPC_API_EMAIL                          -----  app/api/enrich-epc/route.ts lib/ingestion/enrichment/searchland-epc.ts
  EPC_API_KEY                            LOCAL  app/api/enrich-potential-hmos/route.ts app/api/enrich-epc/route.ts lib
  GOOGLE_CUSTOM_SEARCH_API_KEY           -----  app/api/enrich-images/route.ts 
  GOOGLE_CUSTOM_SEARCH_ENGINE_ID         -----  app/api/enrich-images/route.ts 
  GOOGLE_MAPS_API_KEY                    -----  lib/image-fallback.ts 
  KAMMA_API_KEY                          -----  app/api/enrich-potential-hmos/route.ts lib/config/api-config.ts 
  KAMMA_BASE_URL                         -----  lib/config/api-config.ts 
  KAMMA_GROUP_ID                         -----  lib/config/api-config.ts 
  KAMMA_SERVICE_KEY                      -----  lib/config/api-config.ts 
  LAND_REGISTRY_API_KEY                  -----  lib/config/api-config.ts 
  MOCK_PROPERTY_COUNT                    -----  lib/config/api-config.ts 
  NEXT_PUBLIC_APP_URL                    -----  app/api/payments/route.ts 
  NEXT_PUBLIC_BASE_URL                   -----  app/api/enrich-article4/route.ts 
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY        -----  app/actions/listing-matcher.ts app/api/enrich-images/route.ts lib/conf
  NEXT_PUBLIC_SENTRY_DSN                 -----  sentry.server.config.ts sentry.client.config.ts sentry.edge.config.ts 
  NEXT_PUBLIC_SITE_URL                   -----  app/api/track-contact/route.ts components/landing/SignupForm.tsx 
  NEXT_PUBLIC_SUPABASE_ANON_KEY          LOCAL  lib/supabase/client.ts lib/supabase/server.ts middleware.ts 
  NEXT_PUBLIC_SUPABASE_URL               LOCAL  app/api/run-migration/route.ts app/api/enrich-article4/route.ts app/ap
  NODE_ENV                               -----  app/layout.tsx lib/config/api-config.ts lib/integrations/stannp.ts lib
  OFCOM_API_KEY                          -----  lib/config/api-config.ts 
  PATMA_API_KEY                          LOCAL  lib/ingestion/adapters/patma.ts lib/config/api-config.ts lib/ingestion
  PATMA_BASE_URL                         LOCAL  lib/config/api-config.ts lib/ingestion/adapters/patma.ts lib/services/
  PROPERTYDATA_API_KEY                   LOCAL  app/api/enrich-floor-area/route.ts lib/config/api-config.ts lib/ingest
  PROPERTYDATA_BASE_URL                  LOCAL  lib/ingestion/adapters/propertydata-hmo.ts lib/config/api-config.ts li
  RESEND_API_KEY                         -----  app/api/send-notifications/route.ts lib/email/resend.ts 
  SEARCHLAND_API_KEY                     -----  app/api/enrich-potential-hmos/route.ts lib/config/api-config.ts 
  SEARCHLAND_BASE_URL                    -----  lib/config/api-config.ts 
  STANNP_API_KEY                         -----  lib/integrations/stannp.ts 
  STREETDATA_API_KEY                     LOCAL  lib/config/api-config.ts lib/ingestion/adapters/streetdata.ts lib/inge
  STREETDATA_BASE_URL                    LOCAL  lib/ingestion/adapters/streetdata.ts lib/config/api-config.ts lib/serv
  STRIPE_SECRET_KEY                      -----  app/api/payments/route.ts app/api/payments/webhook/route.ts 
  STRIPE_WEBHOOK_SECRET                  -----  app/api/payments/webhook/route.ts 
  SUPABASE_SERVICE_ROLE_KEY              LOCAL  app/api/run-migration/route.ts app/api/enrich-article4/route.ts app/ap
  SUPABASE_URL                           LOCAL  lib/supabase-admin.ts 
  UPSTASH_REDIS_REST_TOKEN               -----  lib/redis.ts 
  UPSTASH_REDIS_REST_URL                 -----  lib/redis.ts 
  USE_MOCK_DATA                          -----  lib/config/api-config.ts 
  ZOOPLA_API_KEY                         -----  app/api/enrich-property-images/route.ts app/api/zoopla-images/route.ts
  ZOOPLA_BASE_URL                        -----  lib/config/api-config.ts 
```

## Appendix D — Vulnerabilities (npm audit)

**35 total: 2 critical, 16 high, 15 moderate, 2 low.**

```
CRITICAL  jspdf                          jsPDF has a PDF Object Injection via Unsanitized Input in addJS Method
CRITICAL  vitest                         When Vitest UI server is listening, arbitrary file can be read and executed
HIGH      brace-expansion                brace-expansion: Zero-step sequence causes process hang and memory exhaustion
HIGH      browserslist                   Browserslist: Unbounded memory growth (no cache eviction) via distinct query r
HIGH      fast-uri                       fast-uri vulnerable to host confusion via literal backslash authority delimite
HIGH      flatted                        flatted vulnerable to unbounded recursion DoS in parse() revive phase
HIGH      js-yaml                        JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases
HIGH      lodash                         lodash vulnerable to Code Injection via `_.template` imports key names
HIGH      minimatch                      minimatch has a ReDoS via repeated wildcards with non-matching literal in patt
HIGH      nanoid                         nanoid: non-secure generators can loop indefinitely with negative size
HIGH      next                           Next.js: HTTP request smuggling in rewrites
HIGH      picomatch                      Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob M
HIGH      postcss                        PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
HIGH      rollup                         Rollup 4 has Arbitrary File Write via Path Traversal
HIGH      serialize-javascript           Serialize JavaScript is Vulnerable to RCE via RegExp.flags and Date.prototype.
HIGH      sharp                          sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CV
HIGH      vite                           Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling
HIGH      ws                             ws: Uninitialized memory disclosure
```

## Appendix E — ESLint errors (22)

```
app/auth/login/page.tsx: 30:21 error Error: Calling setState synchronously within an effect can trigger cascading renders
components/freshness-badge.tsx: 20:7 error Error: Calling setState synchronously within an effect can trigger cascading renders
components/map-inner.tsx: 54:42 error Error: Cannot access variable before it is declared
components/map-inner.tsx:43:3: 81:9 error Error: Cannot access variable before it is declared
components/onboarding-walkthrough.tsx: 94:5 error Error: Calling setState synchronously within an effect can trigger cascading renders
components/owner-information-section.tsx: 284:14 error Error: Cannot create components during render
components/pipeline-board.tsx: 58:11 error An empty interface declaration allows any non-nullish value, including literals like `0` and `""`.
components/pipeline-board.tsx: 81:31 error Unexpected empty object pattern no-empty-pattern
components/property-detail-page.tsx: 89:91 error Empty block statement no-empty
components/property-map.tsx: 90:5 error Error: Calling setState synchronously within an effect can trigger cascading renders
components/saved-searches.tsx: 135:18 error This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain no-dupe-else-if
components/ui/sidebar.tsx: 611:26 error Error: Cannot call impure function during render
components/viewing-tracker.tsx: 40:11 error An empty interface declaration allows any non-nullish value, including literals like `0` and `""`.
lib/ingestion/adapters/rightmove.ts: 322:19 error Unnecessary escape character: \. no-useless-escape
lib/report/hmo-check.ts: 533:40 error React Hook "useAndConversionSection" is called in function "buildHmoCheckReport" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use" react-hooks/rules-of-hooks
lib/report/hmo-check.ts: 534:12 error React Hook "useAndConversionSection" is called in function "buildHmoCheckReport" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use" react-hooks/rules-of-hooks
tests/infrastructure-hardening.test.ts: 233:36 error Unnecessary escape character: \/ no-useless-escape
tests/infrastructure-hardening.test.ts: 233:55 error Unnecessary escape character: \/ no-useless-escape
tests/infrastructure-hardening.test.ts: 233:74 error Unnecessary escape character: \/ no-useless-escape
tests/infrastructure-hardening.test.ts: 233:93 error Unnecessary escape character: \/ no-useless-escape
tests/infrastructure-hardening.test.ts: 233:112 error Unnecessary escape character: \/ no-useless-escape
tests/load/k6-load-test.js: 48:18 error '__ENV' is not defined no-undef
```

## Appendix F — Live schema vs migrations

**21 live tables.** Tables with a `CREATE TABLE` in `supabase/migrations/`: 8, of which 8 do **not** exist in production.

| Live table | rows | in migrations? |
|---|---|---|
| `properties` | 909 | **no** |
| `hmo_planning_decisions` | 994 | yes |
| `article4_councils` | 337 | yes |
| `article4_directions` | 62 | yes |
| `credit_costs` | 7 | no |
| `profiles` | 5 | no |
| `user_credits` | 5 | no |
| `saved_searches` | 1 | no |
| `saved_properties` | 0 | no |
| `price_alerts` | 0 | no |
| `price_alert_history` | 0 | no |
| `tier_changes` | 0 | no |
| `contact_access_log` | 0 | no |
| `user_consent` | 0 | no |
| `gdpr_optouts` | 0 | no |
| `waitlist` | 0 | no |
| `watched_properties` | 0 | no |
| `credit_adjustments` | 0 | yes |
| **`off_market_leads`** | **absent** | yes |
| **`pipeline_deals`** | **absent** | yes |
| **`pipeline_labels`** | **absent** | yes |
| **`pipeline_stage_config`** | **absent** | yes |
| **`property_viewings`** | **absent** | yes |
| **`d2v_templates`** | **absent** | yes |
| **`d2v_campaigns`** | **absent** | yes |
| **`broadband_coverage`** | **absent** | yes |

*(`geography_columns`, `geometry_columns`, `spatial_ref_sys` are PostGIS system views, excluded.)*

---

## Method

- Live schema read from the Supabase PostgREST OpenAPI document, not inferred from code.
- Row counts and column coverage measured with `count: 'exact'` over **all** rows, not sampled.
- Integration states established by **calling each API**, not by reading configuration —
  which is how three integrations reporting `enabled: true` were found to have dead accounts.
- Unauthenticated reachability proven with `curl` against production, no cookies, no credentials.
- Dead-code claims verified individually after the first heuristic pass produced a false positive
  (`map-inner.tsx` is dynamically imported).
- `tsc`, ESLint and `next build` run locally; ESLint and the build were re-run after the first
  capture was found to have been truncated by the collection command.

**No source file was modified. No finding was fixed.**
