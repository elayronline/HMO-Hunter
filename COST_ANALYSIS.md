# HMO Hunter - Full Internal Cost Analysis

**Prepared:** 13 February 2026
**Basis:** 100 active users with scale capabilities
**Currency:** GBP (USD conversions at $1 = £0.79)

---

## Executive Summary

| Category                    | Monthly Cost | Annual Cost  |
|-----------------------------|-------------|-------------|
| Property Data APIs          | £2,499      | £29,988     |
| Infrastructure & Hosting    | £106        | £1,272      |
| Mapping & Geolocation       | £16         | £192        |
| Email & Notifications       | £0          | £0          |
| Monitoring & Analytics      | £23         | £276        |
| **TOTAL**                   | **£2,644**  | **£31,728** |

---

## 1. PROPERTY DATA APIs

These are the primary cost drivers for HMO Hunter.

### 1.1 Searchland — £833/month (£10,000/year)

| Item              | Detail                                              |
|-------------------|------------------------------------------------------|
| **Service**       | Title/ownership, EPC, planning constraints, HMO data |
| **Endpoints used**| `/hmo/search`, `/titles/search`, `/titles/get`, `/constraints/check_title`, `/epc` |
| **Cost**          | £10,000 per annum (confirmed by user)                |
| **Rate limits**   | 60 req/min, 10,000 req/day                           |
| **Monthly**       | **£833**                                             |

### 1.2 Kamma — £300/month (£3,600/year)

| Item              | Detail                                               |
|-------------------|-------------------------------------------------------|
| **Service**       | HMO licensing scheme determination, Article 4, compliance |
| **Endpoints used**| `/v3/determinations/check`                            |
| **Cost**          | £300 per calendar month (confirmed by user)           |
| **Rate limits**   | 60 req/min, 10,000 req/day                            |
| **Monthly**       | **£300**                                              |

### 1.3 PropertyData — £96/month (£1,152/year)

| Item              | Detail                                               |
|-------------------|-------------------------------------------------------|
| **Service**       | National HMO Register data, licence info, occupancy   |
| **Endpoint used** | `/national-hmo-register`                              |
| **Plan**          | API 15k (15,000 credits/month)                        |
| **Why this plan** | 100 users x ~100 lookups/month = ~10,000 credits. 15k plan gives headroom + higher rate limit (6 req/10s vs 4) |
| **Rate limit**    | 6 requests per 10 seconds                             |
| **Monthly**       | **£96**                                               |
| **Annual (11mo)** | £1,056 (annual billing saves 1 month)                 |

### 1.4 StreetData — £200/month (£2,400/year)

| Item              | Detail                                               |
|-------------------|-------------------------------------------------------|
| **Service**       | Property valuations, rental prices, market analytics  |
| **Pricing model** | Pay-as-you-go, no subscription                        |
| **Tier used**     | Core (£0.10/property)                                 |
| **Usage estimate**| ~2,000 property enrichments/month (100 users x 20 properties) |
| **Monthly**       | **£200**                                              |

*Note: StreetData also offers Basic at £0.02/property and Premium at £0.50/property. Core tier provides comprehensive property info including valuations without the ML predictions of Premium.*

### 1.5 PaTMa — £40/month (£480/year)

| Item              | Detail                                               |
|-------------------|-------------------------------------------------------|
| **Service**       | Rental price analytics, sold prices, market trends    |
| **Pricing model** | £20/month subscription + prepaid credits              |
| **Subscription**  | £20/month (excl. VAT)                                 |
| **Credits**       | £50 pack = 10,000 credits (£0.005/credit)             |
| **Usage estimate**| ~3,000 API calls/month = ~£15/month in credits        |
| **VAT (20%)**     | +£4/month on subscription                             |
| **Monthly**       | **£40** (£24 sub inc VAT + £15 credits)               |

### 1.6 Zoopla — £1,000/month (£12,000/year)

| Item              | Detail                                               |
|-------------------|-------------------------------------------------------|
| **Service**       | Rental listings, property images, area pricing        |
| **Access**        | Commercial partnership via Hometrack                   |
| **Endpoints used**| `/property_listings.json`, `/average_area_sold_price.json`, `/zed_index.json` |
| **Cost**          | £1,000 per calendar month (confirmed)                 |
| **Rate limits**   | 100 req/min, 10,000 req/day                           |
| **Monthly**       | **£1,000**                                            |

### 1.7 HM Land Registry — £30/month (£360/year)

| Item              | Detail                                               |
|-------------------|-------------------------------------------------------|
| **Service**       | Title searches, CCOD data                             |
| **Pricing model** | £3 per title search                                   |
| **Usage estimate**| ~10 searches/month (low usage, used for specific enrichment) |
| **Monthly**       | **£30**                                               |

### 1.8 Free Government APIs — £0

| Service              | Purpose                        | Cost |
|----------------------|--------------------------------|------|
| Companies House API  | Corporate landlord lookups      | FREE |
| Ofcom Broadband API  | Broadband/fibre availability    | FREE |
| EPC Register (ODC)   | Energy Performance Certificates | FREE |

---

## 2. INFRASTRUCTURE & HOSTING

### 2.1 Vercel Pro — £63/month (£756/year)

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Plan**              | Pro ($20/month per seat)                    |
| **Seats**             | 3 developer seats (Owner + 2 Members)       |
| **Base cost**         | $60/month = £47/month                       |
| **Bandwidth**         | 1 TB/month included (sufficient for 100 users) |
| **Serverless funcs**  | 1M invocations included                     |
| **Cron jobs**         | 100/project included (1 active: daily notifications) |
| **Build minutes**     | ~$15/month (Turbo builds) = £12/month       |
| **Analytics**         | Included with Pro                           |
| **SSL**               | Free (Let's Encrypt, automatic)             |
| **$20/month credit**  | Offsets compute overages                     |
| **Monthly**           | **£63**                                     |

*Adjust seats as needed: each additional seat = £16/month ($20).*

### 2.2 Supabase Pro — £20/month (£240/year)

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Plan**              | Pro ($25/month)                             |
| **Database**          | 8 GB included (PostgreSQL)                  |
| **Auth MAUs**         | 100,000 included (using ~100 = 0.1%)        |
| **Storage**           | 100 GB included                             |
| **Bandwidth**         | 50 GB egress included                       |
| **Compute**           | Micro tier (shared CPU, 1 GB RAM) — covered by $10 compute credit |
| **Backups**           | Daily, 7-day retention included             |
| **Spend cap**         | ON by default (prevents surprise bills)     |
| **Monthly**           | **£20** ($25)                               |

*At 100 users this plan has massive headroom. No overages expected.*

### 2.3 Domain Name — £1/month (£12/year)

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Domain**            | .co.uk or .com renewal                      |
| **Annual cost**       | ~£10-12/year                                |
| **Monthly**           | **£1**                                      |

---

## 3. MAPPING & GEOLOCATION

### 3.1 Stadia Maps — £16/month (£192/year)

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Service**           | Map tiles (Alidade Smooth) via MapLibre GL  |
| **Plan**              | Starter ($20/month)                         |
| **Credits included**  | 1,000,000/month                             |
| **Est. usage**        | ~340,000 credits/month (100 users x 20 sessions x 150 tiles + geocoding) |
| **Headroom**          | ~3x buffer                                  |
| **Monthly**           | **£16** ($20)                               |

### 3.2 Google Maps (Street View) — £0/month

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Service**           | Street View Static API for property images  |
| **Pricing**           | $7 per 1,000 requests                       |
| **Free tier**         | 10,000 requests/month (no charge)           |
| **Est. usage**        | ~5,000 requests/month (100 users x 50 property views) |
| **Monthly**           | **£0** (within free tier)                   |

*If usage exceeds 10,000 requests: £5.50 per additional 1,000 requests.*

### 3.3 Google Custom Search — £0/month

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Service**           | Image search fallback for property photos   |
| **Free tier**         | 100 queries/day (~3,000/month)              |
| **Est. usage**        | ~500/month (fallback only)                  |
| **Monthly**           | **£0** (within free tier)                   |

> **WARNING:** Google Custom Search API is closed to new customers. Existing keys work until 1 Jan 2027. Plan migration to Vertex AI Search.

---

## 4. EMAIL & NOTIFICATIONS

### 4.1 Resend — £0/month

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Service**           | Transactional email (price alerts, licence expiry notifications) |
| **Plan**              | Free tier                                   |
| **Included**          | 3,000 emails/month, 100/day                 |
| **Est. usage**        | ~300-500 emails/month (100 users, daily digest + alerts) |
| **Monthly**           | **£0**                                      |

*Upgrade trigger: If daily sends exceed 100 or monthly exceeds 3,000, Pro plan is $20/month (£16). This would likely happen at ~150-200 active users.*

---

## 5. MONITORING & ANALYTICS

### 5.1 Sentry — £23/month (£276/year)

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Plan**              | Team ($29/month)                            |
| **Seats**             | Unlimited (no per-user charge)              |
| **Errors included**   | 50,000/month                                |
| **Spans included**    | 5,000,000/month                             |
| **Session replays**   | 50/month included                           |
| **Features active**   | 100% transaction tracing, session replay (10% sample, 100% on error), performance monitoring |
| **Monthly**           | **£23** ($29)                               |

### 5.2 Vercel Analytics & Speed Insights — £0/month

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Service**           | Page performance, user analytics            |
| **Cost**              | Included with Vercel Pro plan               |
| **Monthly**           | **£0**                                      |

---

## 6. WEB SCRAPING

### 6.1 Apify — NOT IN USE

| Item                  | Detail                                     |
|-----------------------|---------------------------------------------|
| **Service**           | Rightmove listing scraper (memo23~rightmove-scraper) |
| **Status**            | Code exists but `APIFY_API_TOKEN` is **not configured** in `.env.local` |
| **Fallback**          | App gracefully skips Apify and uses search links instead of direct Rightmove URLs |
| **Monthly**           | **£0**                                      |

*If activated in future: Apify Starter plan = $49/month (£39).*

---

## 12-Month Cost Projection

### Monthly Breakdown by Line Item

| # | Service            | Category         | Monthly (£) | Annual (£) |
|---|---------------------|-----------------|-------------|------------|
| 1 | Zoopla              | Property Data   | £1,000      | £12,000    |
| 2 | Searchland          | Property Data   | £833        | £10,000    |
| 3 | Kamma               | Property Data   | £300        | £3,600     |
| 4 | StreetData          | Property Data   | £200        | £2,400     |
| 5 | PropertyData        | Property Data   | £96         | £1,152     |
| 6 | PaTMa               | Property Data   | £40         | £480       |
| 7 | HM Land Registry    | Property Data   | £30         | £360       |
| 8 | Vercel Pro (3 seats)| Hosting         | £63         | £756       |
| 9 | Supabase Pro        | Database        | £20         | £240       |
| 10| Sentry Team         | Monitoring      | £23         | £276       |
| 11| Stadia Maps         | Mapping         | £16         | £192       |
| 12| Domain renewal      | Infrastructure  | £1          | £12        |
| 13| Google Maps         | Mapping         | £0          | £0         |
| 14| Google Custom Search| Mapping         | £0          | £0         |
| 15| Resend              | Email           | £0          | £0         |
| 16| Vercel Analytics    | Analytics       | £0          | £0         |
| 17| Companies House     | Gov API         | £0          | £0         |
| 18| Ofcom Broadband     | Gov API         | £0          | £0         |
| 19| EPC Register        | Gov API         | £0          | £0         |
| 20| Apify               | Scraping        | £0          | £0 (not in use) |
|   | **TOTAL**           |                 | **£2,622**  | **£31,468**|

### Monthly Breakdown by Category

| Category                        | Monthly (£) | Annual (£)  | % of Total |
|---------------------------------|-------------|-------------|------------|
| Property Data APIs (paid)       | £2,499      | £29,992     | 95.3%      |
| Hosting & Database              | £84         | £1,008      | 3.2%       |
| Mapping & Geolocation           | £16         | £192        | 0.6%       |
| Monitoring & Analytics          | £23         | £276        | 0.9%       |
| Email & Notifications           | £0          | £0          | 0.0%       |
| Domain & SSL                    | £1          | £12         | 0.0%       |
| **TOTAL**                       | **£2,622**  | **£31,468** | **100%**   |

---

## Cumulative 12-Month View

| Month | Monthly Cost | Cumulative Cost |
|-------|-------------|-----------------|
| 1     | £2,622      | £2,622          |
| 2     | £2,622      | £5,244          |
| 3     | £2,622      | £7,866          |
| 4     | £2,622      | £10,488         |
| 5     | £2,622      | £13,110         |
| 6     | £2,622      | £15,732         |
| 7     | £2,622      | £18,354         |
| 8     | £2,622      | £20,976         |
| 9     | £2,622      | £23,598         |
| 10    | £2,622      | £26,220         |
| 11    | £2,622      | £28,842         |
| 12    | £2,622      | £31,464         |

---

## Scale Triggers & Cost at Growth Milestones

Costs that change as you scale beyond 100 users:

| Users | Key changes                                          | Est. Monthly |
|-------|------------------------------------------------------|-------------|
| 100   | Current analysis (baseline)                          | £2,622      |
| 250   | PropertyData → API 50k (£192), StreetData → £500, Resend → Pro (£16), Stadia → Standard (£63) | £3,191  |
| 500   | PropertyData → API 100k (£288), StreetData → £1,000, Supabase compute upgrade (£79), Sentry overages (~£40) | £4,061 |
| 1,000 | Searchland renegotiation needed, Google Maps overages (~£35), Vercel bandwidth overages (~£30) | £4,500+ |

---

## Risks & Action Items

### Immediate Actions
1. **Google Custom Search** — Closed to new customers, sunset 1 Jan 2027. Plan migration to Vertex AI Search or alternative image sourcing

### Cost Optimisation Opportunities
1. **StreetData caching** — Implement aggressive caching to reduce per-property lookups (potential 30-50% saving = £60-100/month)
2. **PropertyData annual billing** — Save 1 month (~£96/year) by paying annually
3. **Searchland** — Negotiate volume discounts if usage increases significantly
4. **Batch enrichment** — Queue and batch API calls during off-peak to maximise rate limits and reduce redundant calls

### Assumptions & Caveats
- USD→GBP converted at $1 = £0.79 (rate fluctuations may apply)
- All usage estimates based on 100 active users with moderate daily usage (10-20 property interactions/day)
- VAT not included except where noted (PaTMa). Add 20% VAT where applicable for UK-registered services
- StreetData costs are usage-dependent with no monthly minimum — actual costs may vary significantly
