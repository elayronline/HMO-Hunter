# Sentry Alerts Configuration

## Setup in Sentry Dashboard

After deploying, configure these alerts in your Sentry project:

### 1. Critical Database Errors
- **Trigger:** `tags.category:database`
- **Threshold:** 1 event
- **Action:** Email + Slack immediately

### 2. Authentication Failures Spike
- **Trigger:** `tags.category:auth`
- **Threshold:** 10 events in 5 minutes
- **Action:** Email notification

### 3. High Error Rate
- **Trigger:** Error count
- **Threshold:** 50 errors in 10 minutes
- **Action:** Email + Slack

### 4. API Rate Limiting Alerts
- **Trigger:** `tags.category:rate_limit`
- **Threshold:** 100 events in 5 minutes
- **Action:** Email (possible abuse detection)

## Tags Added by Our Config

The `sentry.server.config.ts` automatically adds these tags:

| Tag | Values | Description |
|-----|--------|-------------|
| `category` | `auth`, `credits`, `database`, `rate_limit` | Error type |
| `severity` | `low`, `medium`, `high`, `critical` | Priority |
| `area` | `admin`, `enrichment`, `export` | App section |
| `source` | `api` | Origin |

## How to Create Alerts

1. Go to **Sentry Dashboard** > **Alerts**
2. Click **Create Alert**
3. Choose **Issue Alert** for error-based
4. Set conditions using the tags above
5. Configure notification channels

## Recommended Alert Rules

```
# Critical - Immediate action required
IF tags.severity:critical
THEN notify Slack #alerts + Email immediately

# High - Investigate within 1 hour
IF tags.severity:high AND count > 5 in 10min
THEN notify Email

# Medium - Review daily
IF tags.severity:medium AND count > 20 in 1hr
THEN notify Email digest

# Low - Weekly review
IF tags.category:rate_limit AND count > 100 in 1hr
THEN notify Email (possible abuse)
```

## Environment Variables Required

```env
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=your_auth_token
```
