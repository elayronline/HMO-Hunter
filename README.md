# HMO Hunter

A property intelligence platform for finding and analysing HMO (House in Multiple Occupation) investment opportunities in the UK.

---

## Project Status (August 2026)

### Built

| Feature | Notes |
|---------|-------|
| Interactive Map View | MapLibre GL with clustered markers, collapsible legend |
| Property Filtering | Three sourcing categories, EPC, Article 4, licence status, floor area |
| HMO Checker | An address in, a defensible report out (`/hmo-check`) |
| Attention Dashboard | `/user-dashboard` — what needs attention, not four counts |
| Title Owner Section | Land Registry data |
| Licence Holder Section | Council register data, where a register was reachable |
| Company Lookup | Links to Companies House for corporate landlords |
| GDPR Compliance | Audit logging, opt-out system, privacy policy |
| Property Images | Google Street View integration with accurate heading |
| Saved Searches / Saved Listings | `components/saved-searches.tsx`, `/saved` |
| Comparison, Pipeline, Viewings | Side-by-side compare, pipeline board, viewing tracker |
| CSV Export | Exports the filtered set; verified against the database |
| Multi-City Support | London, Manchester, Birmingham, Leeds, Bristol, etc. |

**Removed on purpose — do not rebuild:**

- **Deal Scoring** — a 0–100 score built partly on an invented yield. Removed in
  `5396d0f`. The `deal_score` column still holds 1,016 stale values; nothing
  reads them.
- **Yield Calculator / Yield Band** — banded a yield derived from a city-average
  room rent, which is an estimate stacked on an estimate. See the no-fabricated
  data rule in `CLAUDE.md`.
- **Predicted Article 4 overlay** — asserted a restriction no council had made.

### Data Sources - Current Status

| Source | Purpose | Status |
|--------|---------|--------|
| Supabase | Database & Auth | ✅ Connected |
| Searchland | Title/EPC/Planning | ⚫ Unpaid, dark by choice |
| Companies House | Corporate landlord details | ✅ Configured |
| StreetData | Enrichment | ✅ Connected (was reading an empty key under a second spelling) |
| PATMA | Enrichment | ✅ Connected (was split across two hostnames) |
| EPC Register | EPC ratings | ⚠️ Key set, `EPC_API_EMAIL` missing — Basic auth needs both |
| Google Street View | Property images | ✅ Working |
| Google Custom Search | Listing images | ⚠️ 403 errors (quota/config issue) |
| Kamma / Zoopla | HMO licence registers, listings | ⚫ Unpaid, dark by choice |

### Known Limitations

- **Cron jobs are not running.** All five in `vercel.json` compare against
  `Bearer ${CRON_SECRET}`, which is unset in Vercel — so every scheduled run
  returns 401. Setting it starts ingestion writing to the database and the
  notification job sending mail; that is a deliberate decision, not a config fix.
- **Room rents**: 764 of 1,525 properties fall back to a single national average
  (£525) because their city is not in the 27-city table in
  `lib/properties/room-rents.ts`. It is labelled as such, and it is the weakest
  figure in any report that uses it.
- **Article 4 recall is 71.2%** against the hand-verified gold set (17 misses),
  because the national feed is voluntary and many councils never file. Measured
  by `tests/article4-eval.test.ts`, not claimed.
- **Licence terms**: the seeded values migration 012 invented have been cleared.
  Where no register published a reference or dates, the property now says so.
- **Payments are not built.** Stripe integration is deliberately deferred to the
  end; the `stripe` package is not installed, which is the only reason
  `npx tsc --noEmit` reports 2 errors. Premium status reads a
  `user_metadata.is_premium` flag set by hand in the Supabase dashboard.
- **Property Images**: some properties show approximate Street View angles.

---

## What It Does

HMO Hunter aggregates property data from multiple sources and enriches it with ownership, licensing, and contact information to help property investors identify and contact HMO landlords.

### Core Features

- **Interactive Map View** - Browse HMO properties across UK cities with clustered markers
- **Property Filtering** - Filter by price, bedrooms, HMO status, EPC rating, Article 4 areas
- **Deal Scoring** - Automated scoring (0-100) based on yield potential, compliance, and contact availability
- **Owner Information** - Two distinct contact categories:
  - **Title Owner** (blue) - Legal owner from Land Registry
  - **Licence Holder** (teal) - HMO licence holder from council registers
- **Company Lookup** - Links to Companies House for corporate landlords
- **GDPR Compliant** - Audit logging, opt-out system, and privacy policy

### Data Sources

| Source | Data Provided |
|--------|---------------|
| Land Registry (via Searchland) | Title owner name, address |
| Companies House | Company details, directors |
| Council HMO Registers | Licence holder, licence details |
| EPC Register | Energy ratings |

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Maps**: MapLibre GL
- **APIs**: Searchland, Companies House

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys to .env.local

# Run database migrations in Supabase SQL Editor
# (see scripts/*.sql)

# Start development server
pnpm dev
```

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SEARCHLAND_API_KEY=your_searchland_key
COMPANIES_HOUSE_API_KEY=your_companies_house_key
```

---

## Next Steps

### High Priority - API Integration

- [ ] **Kamma API Integration** - Replace sample licence data with real HMO licence register data
  - Licence holder names, start/end dates, max occupants
  - Update `lib/ingestion/adapters/` with Kamma adapter
  - Sample licence data has been cleared (`scripts/016_clear_seeded_licence_data.sql`); `scripts/DO_NOT_RUN_012_populate_licence_term_data.sql` is quarantined and must not be run again

### High Priority - Decisions Waiting

- [ ] **Set `CRON_SECRET` in Vercel** - Unblocks all five scheduled jobs at once.
  Starts ingestion writing to the live database and the notification job sending
  real mail, so it needs a deliberate go-ahead rather than a quiet deploy.
- [ ] **Set `EPC_API_EMAIL`** - The EPC API uses HTTP Basic with the registered
  email as the username, so the paid key authenticates nothing without it.

### Medium Priority - Listing Enhancements

- [ ] **Purchase Property View** - Stress test and optimize the purchase listing experience
- [ ] **Premium Tier Toggle** - Access control for HMO listings. Blocked on the
  Stripe work above; the `is_premium` flag is the manual stand-in.

### Compliance & Legal

- [ ] **Register with ICO** (£52/year) - Required before using contact tracing services
  - https://ico.org.uk/for-organisations/register/
- [ ] **Complete Legitimate Interest Assessment** - Document in `docs/` folder
- [ ] **Sign Data Processing Agreement** with tracing provider (TraceGO/Find UK People)

### Feature Development

- [ ] **Integrate Paid Tracing Service** - Add phone/email lookup for individual owners
  - TraceGO API (~£30/lookup) or Find UK People (~£49/lookup)
  - Store results in `owner_contact_phone` / `owner_contact_email` fields

### Data Quality

- [ ] **Widen the room-rent table** - 764 of 1,525 properties use the single
  national fallback (£525). Extend `lib/properties/room-rents.ts` beyond 27
  cities, or derive from local comparables.
- [ ] **Improve Geocoding** - Some properties have postcode-level coordinates only
- [ ] **Council API Integration** - Connect to real council HMO register APIs (most are not public)
- [ ] **Close the Article 4 gap** - 17 councils missed; curated research is the
  only fix where the national feed holds nothing.

### UI/UX Improvements

- [ ] **Put the map on `AppShell`** - `app/map/page.tsx` is ~2,200 lines with its
  own nav inline, unlike `/user-dashboard` and `/hmo-check`.
- [ ] **Mobile Responsive** - Optimize map and panels for mobile devices
- [ ] **Detail panel and legend** - The right panel holds ~370px to say "Select a
  property"; the legend floats over Wales.

---

## Database Migrations

Run these in Supabase SQL Editor in order:

1. `scripts/001_create_properties_table.sql`
2. `scripts/002_create_profiles_table.sql`
3. `scripts/003_create_saved_properties_table.sql`
4. `scripts/005_add_owner_enrichment_fields.sql`
5. `scripts/006_add_potential_hmo_fields.sql`
6. `scripts/008_gdpr_compliance_tables.sql`
7. `scripts/009_add_licence_holder_contact_fields.sql`
8. `scripts/010_add_licence_types_table.sql`
9. `scripts/011_add_licence_term_fields.sql` - Adds licence_id, start/end dates, status
10. ~~`scripts/DO_NOT_RUN_012_populate_licence_term_data.sql`~~ - **DO NOT RUN.** Invented licence
    references, terms and occupancies. Cleared by `scripts/016_clear_seeded_licence_data.sql`;
    kept only as the provenance record that code comments cite by name.
11. `scripts/016_clear_seeded_licence_data.sql` - Clears the data migration 012 invented.
    Applied to production; verified 2026-08-16 with all four seeded columns at 0 and the
    published columns (`hmo_licence_reference`, `hmo_licence_expiry`) untouched. Safe to
    re-run — every statement is guarded on the seeded values still being present.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/enrich-owner` | POST | Fetch title owner from Searchland |
| `/api/scrape-council-hmo` | POST | Fetch licence holder from council registers |
| `/api/gdpr/data-request` | POST | Handle GDPR opt-out requests |
| `/api/gdpr/log-access` | POST | Log contact data access |
| `/api/debug-properties` | GET | Debug property data |

---

## GDPR Compliance

See `docs/GDPR-COMPLIANCE-CHECKLIST.md` for full requirements.

**Implemented:**
- Privacy policy page (`/privacy`)
- Data request form (`/data-request`)
- Audit logging for contact access
- Opt-out filtering in queries

**Pending:**
- ICO registration
- Legitimate Interest Assessment document
- Data Processing Agreement with tracing provider

---

## License

Private - All rights reserved
