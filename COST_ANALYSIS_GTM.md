# HMO Hunter — Operating Cost Breakdown

> **Date:** February 2026 | **Basis:** 100 users | **Review period:** 12 months

---

## Summary — by Category

Annual assumes growth from 100 to 500 users over 12 months.

| Category | Current Monthly | Annual |
|----------|----------------|-------------------|
| Property APIs | £2,499 | £35,594 |
| Hosting & Platform | £84 | £1,404 |
| Monitoring & Mapping | £39 | £616 |
| **Total** | **£2,622** | **£37,614** |

## Summary — by Service

| Service | Current Monthly | Annual |
|---------|----------------|-------------------|
| Zoopla | £1,000 | £12,000 |
| Searchland | £833 | £10,000 |
| StreetData | £200 | £6,600 |
| Kamma | £300 | £3,600 |
| PropertyData | £96 | £2,064 |
| Vercel | £63 | £756 |
| PaTMa | £40 | £570 |
| HM Land Registry | £30 | £480 |
| Supabase | £20 | £468 |
| Sentry | £23 | £408 |
| Stadia Maps | £16 | £408 |
| Resend | £0 | £112 |
| Domain | £1 | £12 |
| **Total** | **£2,622** | **£37,614** |

---

## What Each Service Does

| Service | What it does for HMO Hunter |
|---------|----------------------------|
| **Zoopla** | Provides live rental listings, property photos, and area pricing data. Powers the listing search and comparable rent analysis. |
| **Searchland** | Supplies title ownership, EPC ratings, planning constraints, and Article 4 direction data. Core to identifying who owns a property and what restrictions apply. |
| **StreetData** | Delivers property valuations, rental yield estimates, and market analytics. Drives the investment analysis and deal scoring. |
| **Kamma** | Checks whether a property requires an HMO licence, what licensing scheme applies, and whether the area has Article 4 restrictions. Essential for compliance screening. |
| **PropertyData** | Searches the National HMO Register to find existing licensed HMOs, licence expiry dates, and occupancy details. |
| **PaTMa** | Provides rental price analytics, sold price history, and market trends to support investment decision-making. |
| **HM Land Registry** | Performs official title searches to confirm property ownership and identify corporate landlords. Charged at £3 per search. |
| **Vercel** | Hosts the web application, runs scheduled tasks (daily email notifications), and handles deployments. |
| **Supabase** | Manages the database (all property, user, and search data) and handles user authentication and login. |
| **Sentry** | Monitors the application for errors and performance issues. Alerts the team when something breaks. |
| **Stadia Maps** | Renders the interactive map interface where users browse and filter properties by location. |
| **Resend** | Sends transactional emails — price drop alerts, licence expiry warnings, and user notifications. Currently free, moves to paid at ~200 users. |
| **Domain** | The HMO Hunter domain name (.co.uk / .com) renewal. |

7 additional services (Google Maps Street View, Google Custom Search, Companies House, Ofcom Broadband, EPC Register, Vercel Analytics, Google Custom Search) currently operate at no cost within free tiers.

---

## 12-Month Projection (with user growth)

Growth assumption: 100 users at launch, scaling to 500 by month 12.

| Month | Users | Monthly Cost | Cumulative |
|-------|-------|-------------|------------|
| 1 | 100 | £2,622 | £2,622 |
| 2 | 120 | £2,670 | £5,292 |
| 3 | 140 | £2,720 | £8,012 |
| 4 | 160 | £2,790 | £10,802 |
| 5 | 180 | £2,870 | £13,672 |
| 6 | 200 | £2,950 | £16,622 |
| 7 | 230 | £3,060 | £19,682 |
| 8 | 260 | £3,191 | £22,873 |
| 9 | 300 | £3,350 | £26,223 |
| 10 | 350 | £3,550 | £29,773 |
| 11 | 420 | £3,780 | £33,553 |
| 12 | 500 | £4,061 | £37,614 |

**Q1:** £8,012 | **H1:** £16,622 | **Q3:** £26,223 | **Full Year:** £37,614

Key triggers as we scale: Resend moves to paid at ~200 users (month 6), PropertyData and Stadia Maps upgrade tiers at ~250 users (month 8), StreetData usage doubles at ~350 users (month 10), Supabase compute upgrade at ~500 users (month 12).

---

## What's Driving the Increase

| Cost driver | At 100 users | At 500 users | Change |
|-------------|-------------|-------------|--------|
| Fixed contracts (Zoopla, Searchland, Kamma) | £2,133 | £2,133 | £0 (no change) |
| StreetData (usage-based) | £200 | £1,000 | +£800 |
| PropertyData (plan upgrade) | £96 | £288 | +£192 |
| Stadia Maps (plan upgrade) | £16 | £63 | +£47 |
| Supabase (compute upgrade) | £20 | £79 | +£59 |
| Sentry (overages) | £23 | £63 | +£40 |
| Resend (free → paid) | £0 | £16 | +£16 |
| Other (PaTMa, Land Registry, Vercel, Domain) | £134 | £164 | +£30 |
| **Total** | **£2,622** | **£4,061** | **+£1,439** |

Fixed contracts (Zoopla £1,000, Searchland £833, Kamma £300) remain constant regardless of user count — these account for 81% of current spend. Cost per user drops from £26.22 at 100 users to £8.12 at 500 users.

---

## Cost Optimisation Opportunities

| Opportunity | Potential Saving | Effort |
|-------------|-----------------|--------|
| PropertyData annual billing | £96/year | Low |
| StreetData response caching | £60–100/month | Medium |
| Batch API enrichment (off-peak) | Reduced rate limit pressure | Medium |
| Searchland volume discount (at scale) | TBD — negotiate | Low |

---

*All figures in GBP. USD services converted at $1 = £0.79. VAT excluded unless noted. Usage estimates based on 100 active users with moderate daily usage.*
