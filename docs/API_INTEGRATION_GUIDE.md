# HMO Hunter API Integration Guide

## Overview

HMO Hunter uses a two-phase data architecture to provide comprehensive HMO property information:

- **Phase 1**: Core HMO licence data from official registers
- **Phase 2**: Property enrichment with valuations, characteristics, and market analytics

## Phase 1 - Core HMO Data Sources

### 1. Searchland HMO API (Primary)

**Purpose**: Official HMO licence database
**Data Provided**:
- HMO licence ID and status
- Property address and geolocation
- Number of bedrooms
- Licence start/end dates
- Maximum occupants

**Setup**:
```bash
# Add to environment variables
SEARCHLAND_API_KEY=your_api_key_here
```

**API Documentation**: https://api.searchland.co.uk/docs

### 2. PropertyData HMO Register (Supplementary)

**Purpose**: National HMO register for additional coverage
**Data Provided**:
- HMO licence references
- Local authority information
- UPRN (Unique Property Reference Number) for deduplication
- Licence status and expiry

**Setup**:
```bash
PROPERTYDATA_API_KEY=your_api_key_here
```

**API Documentation**: https://propertydata.co.uk/api

## Phase 2 - Enrichment Sources

### 3. Street Data API

**Purpose**: Property characteristics and baseline features
**Data Provided**:
- Property type and year built
- UPRN identifiers
- Garden, parking availability
- Property age classification

**Setup**:
```bash
STREET_DATA_API_KEY=your_api_key_here
```

### 4. PaTMa Property Data API

**Purpose**: Valuation and investment metrics
**Data Provided**:
- Estimated property values
- Area average rents
- Rental yield calculations
- Area population statistics

**Setup**:
```bash
PATMA_API_KEY=your_api_key_here
```

## Data Flow

```
Phase 1 (Core Data)
┌─────────────────────┐      ┌──────────────────────┐
│  Searchland HMO API │      │ PropertyData HMO API │
└──────────┬──────────┘      └──────────┬───────────┘
           │                             │
           └──────────┬──────────────────┘
                      ▼
              ┌───────────────┐
              │ Deduplication │ (by UPRN)
              │   & Storage   │
              └───────┬───────┘
                      │
Phase 2 (Enrichment)  │
           ┌──────────▼──────────┐
           │                     │
    ┌──────▼──────┐      ┌──────▼──────┐
    │ Street Data │      │    PaTMa    │
    │     API     │      │     API     │
    └──────┬──────┘      └──────┬──────┘
           │                     │
           └──────────┬──────────┘
                      ▼
              ┌───────────────┐
              │   Enriched    │
              │  Properties   │
              └───────────────┘
```

## Deduplication Strategy

Properties are deduplicated using:
1. **UPRN** (Unique Property Reference Number) - most reliable
2. **Postcode + Licence ID** - fallback for properties without UPRN

## Running Ingestion

```typescript
// Manual ingestion via admin panel
import { ingestProperties } from "@/app/actions/ingest-properties"

// Ingest from all Phase 1 sources + enrichment
await ingestProperties()

// Ingest from specific source
await ingestProperties("Searchland HMO")
```

## API Rate Limits

- Searchland: 1000 requests/day (free tier)
- PropertyData: 500 requests/day (free tier)
- Street Data: 10,000 requests/month
- PaTMa: 5,000 requests/month

## Testing

All API keys should be configured in environment variables. Without valid keys, adapters will log warnings and skip fetching.

## Legal Compliance

All data sources used are:
✅ Licensed APIs with proper terms of service
✅ No web scraping or ToS violations
✅ Legal for commercial use with proper attribution
✅ Official government and partner data sources
