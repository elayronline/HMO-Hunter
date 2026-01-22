# HMO Hunter - Legitimate API Configuration Guide

This guide explains how to set up the legitimate data sources for HMO Hunter.

## Required API Keys

### Phase 1: Core HMO Data (Essential)

#### 1. PropertyData - National HMO Register
**Purpose:** Official HMO licensing and registration data
**Website:** https://propertydata.co.uk/api
**Pricing:** £49-199/month depending on usage
**Environment Variables:**
```env
PROPERTYDATA_API_KEY=pk_live_xxx
PROPERTYDATA_BASE_URL=https://api.propertydata.co.uk
```

**Setup Steps:**
1. Sign up at https://propertydata.co.uk
2. Choose the "HMO Register Access" plan
3. Generate your API key in Settings
4. Add the key to your environment variables

---

### Phase 2: Property Enrichment (Optional but Recommended)

#### 2. Street Data API
**Purpose:** Property valuations, rental estimates, and area analytics
**Website:** https://street.co.uk
**Pricing:** Pay-per-request or subscription (£99-299/month)
**Environment Variables:**
```env
STREETDATA_API_KEY=sk_live_xxx
STREETDATA_BASE_URL=https://api.street.co.uk
```

**Setup Steps:**
1. Register at https://street.co.uk
2. Select "Property Valuation API" plan
3. Generate API credentials
4. Configure webhook endpoint (optional)

#### 3. PaTMa API
**Purpose:** Transaction history, tenant demand analytics, and market insights
**Website:** https://patma.co.uk
**Pricing:** Enterprise pricing (contact sales)
**Get API Key:** https://app.patma.co.uk/profile/api_keys/create
**Environment Variables:**
```env
PATMA_API_KEY=your_patma_api_key_here
```

**Setup Steps:**
1. Visit https://app.patma.co.uk/profile/api_keys/create
2. Create and copy your API key
3. Add the key to your environment variables

---

## Adding Environment Variables to Vercel

### Via Vercel Dashboard:
1. Go to your project in Vercel
2. Navigate to Settings → Environment Variables
3. Add each variable with its value
4. Select environments (Production, Preview, Development)
5. Click "Save"

### Via v0 Interface:
1. In the v0 chat, go to the sidebar
2. Click on "Vars" section
3. Add each environment variable
4. Values will sync to your Vercel project

---

## Development Mode (Free Alternatives)

For testing during development, you can use these free alternatives:

### Mock API Mode
```env
USE_MOCK_DATA=true
MOCK_PROPERTY_COUNT=50
```

This will generate realistic demo data without requiring API keys.

### Free Tier Options
- **PropertyData:** Has a limited free tier (100 requests/month)
- **Street Data:** Free trial available (7 days, 500 requests)

---

## Security Best Practices

1. **Never commit API keys to git**
   - API keys are automatically gitignored in `.env.local`
   - Use environment variables only

2. **Rotate keys regularly**
   - Change API keys every 90 days
   - Immediately rotate if compromised

3. **Use different keys per environment**
   - Separate keys for development/staging/production
   - Helps with debugging and security

4. **Monitor API usage**
   - Set up alerts for unusual activity
   - Track costs in API provider dashboards

---

## Cost Estimation

### Minimum Viable Product (MVP):
- **PropertyData:** £49/month
- **Total:** ~£49/month

### Full Production:
- **PropertyData:** £199/month
- **Street Data:** £299/month
- **PaTMa:** £500/month
- **Total:** ~£998/month

### Free Development:
- Use `USE_MOCK_DATA=true`
- Test with PropertyData free tier
- **Total:** £0/month

---

## Testing Your Setup

After adding API keys, test the integration:

1. Go to `/stress-test` page in HMO Hunter
2. Run the stress test to verify all APIs
3. Check the API status shows "connected"
4. Run a test ingestion with 5-10 properties

---

## Troubleshooting

### "API key invalid" error:
- Verify key is copied correctly (no spaces)
- Check key hasn't expired
- Ensure you have active subscription

### "Rate limit exceeded":
- Wait for rate limit to reset (usually 1 hour)
- Upgrade to higher tier plan
- Implement request caching (already built-in)

### "No properties returned":
- Check your search criteria (location, bedrooms)
- Verify APIs have data for your target area
- Some areas may have limited HMO listings

---

## Support

- **PropertyData:** help@propertydata.co.uk
- **Street Data:** api-support@street.co.uk
- **PaTMa:** support@patma.co.uk
