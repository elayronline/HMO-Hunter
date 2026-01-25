# HMO Hunter

A property intelligence platform for finding and analysing HMO (House in Multiple Occupation) investment opportunities in the UK.

---

## Project Status (January 2025)

### Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| Interactive Map View | ✅ Complete | MapLibre GL with clustered markers, collapsible legend |
| Property Filtering | ✅ Complete | Price, bedrooms, HMO status, EPC, Article 4, licence types |
| Deal Scoring System | ✅ Complete | 0-100 score based on yield, compliance, contact availability |
| Title Owner Section | ✅ Complete | Blue-themed card with Land Registry data |
| Licence Holder Section | ✅ Complete | Teal-themed card with council register data |
| Licence Type & Term Display | ✅ Complete | Shows licence type, start/end dates, max occupants |
| Company Lookup | ✅ Complete | Links to Companies House for corporate landlords |
| GDPR Compliance | ✅ Complete | Audit logging, opt-out system, privacy policy |
| Property Images | ✅ Complete | Google Street View integration with accurate heading |
| Multi-City Support | ✅ Complete | London, Manchester, Birmingham, Leeds, Bristol, etc. |

### Data Sources - Current Status

| Source | Purpose | Status |
|--------|---------|--------|
| Supabase | Database & Auth | ✅ Connected |
| Searchland | Title/EPC/Planning | ✅ Configured (enrichment pending) |
| Companies House | Corporate landlord details | ✅ Configured |
| Google Street View | Property images | ✅ Working |
| Google Custom Search | Listing images | ⚠️ 403 errors (quota/config issue) |
| Kamma API | HMO licence registers | 🔜 Pending API access |

### Known Limitations

- **Licence Data**: Currently using sample data for licence terms. Real data will come from Kamma API once access is granted.
- **Property Images**: Some properties show approximate Street View angles; Custom Search API needs troubleshooting.
- **Searchland Ingestion**: Returns 0 results for HMO endpoint (may not be correct endpoint for licence data).

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
  - Remove sample data from `scripts/012_populate_licence_term_data.sql`

### High Priority - Core Features

- [ ] **Saved Searches** - Allow users to save filter configurations for quick access
- [ ] **Save Listings** - Enable users to save/favourite individual properties
- [ ] **Yield Calculator** - Add ROI calculator for each listing showing:
  - 1-year projected yield
  - 3-year projected yield
  - 5-year projected yield
  - Based on purchase price, estimated rent, and running costs

### Medium Priority - Listing Enhancements

- [ ] **Floor Plans** - Pull floor plan images where available from listing sources
- [ ] **Purchase Property View** - Stress test and optimize the purchase listing experience
- [ ] **Premium Tier Toggle** - Add access control for HMO listings:
  - Free tier: Limited property views
  - Premium tier: Full HMO listing access with contact data

### Compliance & Legal

- [ ] **Register with ICO** (£52/year) - Required before using contact tracing services
  - https://ico.org.uk/for-organisations/register/
- [ ] **Complete Legitimate Interest Assessment** - Document in `docs/` folder
- [ ] **Sign Data Processing Agreement** with tracing provider (TraceGO/Find UK People)

### Feature Development

- [ ] **Integrate Paid Tracing Service** - Add phone/email lookup for individual owners
  - TraceGO API (~£30/lookup) or Find UK People (~£49/lookup)
  - Store results in `owner_contact_phone` / `owner_contact_email` fields
- [ ] **Scheduled Data Enrichment** - Cron job to enrich properties with missing owner data
- [ ] **User Authentication** - Restrict contact data to logged-in users
- [ ] **Export Functionality** - CSV/Excel export of filtered properties
- [ ] **Email Alerts** - Notify users of new properties matching criteria

### Data Quality

- [ ] **Improve Geocoding** - Some properties have postcode-level coordinates only
- [ ] **Council API Integration** - Connect to real council HMO register APIs (most are not public)
- [ ] **EPC Data Enrichment** - Fetch EPC ratings for properties missing them
- [ ] **Stale Data Cleanup** - Mark properties as stale when listings are removed

### UI/UX Improvements

- [ ] **Mobile Responsive** - Optimize map and panels for mobile devices
- [ ] **Property Comparison** - Side-by-side comparison of selected properties
- [ ] **Activity Dashboard** - Track which properties users have contacted
- [ ] **Notes System** - Allow users to add private notes to properties

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
10. `scripts/012_populate_licence_term_data.sql` - **Sample data** (replace with Kamma API)

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
