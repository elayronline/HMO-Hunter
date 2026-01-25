# GDPR Compliance Checklist for HMO Hunter

## Overview

This document outlines the required steps to legally use contact tracing services for finding landlord/owner contact details under UK GDPR.

---

## Actionable Steps

### Step 1: Register with ICO
- **Cost**: £52/year
- **URL**: https://ico.org.uk/for-organisations/register/
- **Timeline**: Must complete BEFORE processing any personal contact data
- **Renewal**: Annual
- **Status**: [ ] Not started

### Step 2: Complete Legitimate Interest Assessment (LIA)
Document the following:

| Question | Our Answer |
|----------|------------|
| What is the legitimate interest? | Connecting property investors with HMO landlords for potential transactions |
| Is processing necessary? | Yes - cannot facilitate property deals without owner contact |
| Does it override individual privacy? | No - property ownership is semi-public, contact is for legitimate business purposes |

- **Status**: [ ] Not started

### Step 3: Create Privacy Policy
Add a `/privacy` page to the website covering:
- What personal data we collect (owner names, phone, email)
- Why we collect it (facilitate HMO property transactions)
- Legal basis (legitimate interest)
- How long we keep it (maximum 24 months)
- Data subject rights (access, erasure, objection)
- How to opt out

- **Status**: [x] IMPLEMENTED - `/app/privacy/page.tsx`

### Step 4: Implement Data Subject Rights
- Add "Remove My Data" request form
- Process removal requests within 30 days
- Log all data access and deletions

- **Status**: [x] IMPLEMENTED - `/app/data-request/page.tsx` and `/api/gdpr/data-request`

### Step 5: Set Up Data Processing Agreements
Before using any tracing service:
- Verify their GDPR compliance
- Sign Data Processing Agreement (DPA)
- Document in Records of Processing Activities

- **Status**: [ ] Not started - required before using TraceGO or similar

### Step 6: Implement Technical Safeguards
- Audit trail: Log who accessed contact data and when
- Auto-delete: Remove contact data after 24 months of no use
- Access control: Limit who can view contact details
- Encryption: Secure storage of personal data

- **Status**: [x] IMPLEMENTED
  - Audit logging: `/api/gdpr/log-access`
  - Opt-out filtering: `app/actions/properties.ts`
  - Database tables: `scripts/008_gdpr_compliance_tables.sql`

---

## Risk Levels by Data Source

| Source | Risk | Action Required |
|--------|------|-----------------|
| Companies House | Low | Free to use, public record |
| Land Registry (owner names) | Low | Public record via Searchland |
| Council HMO registers (names) | Medium | Public but privacy-sensitive |
| Tracing services (phone/email) | Higher | Full LIA required |

---

## Costs Summary

| Item | Cost | Frequency |
|------|------|-----------|
| ICO Registration | £52 | Annual |
| Legal review (optional) | £200-500 | One-time |
| Tracing lookups | £30-50 | Per lookup |

---

## Timeline

1. **Week 1**: Register with ICO
2. **Week 1**: Complete LIA document
3. **Week 2**: Add privacy policy page
4. **Week 2**: Add opt-out mechanism
5. **Week 3**: Set up DPA with tracing provider
6. **Ongoing**: Maintain audit logs and process data requests

---

## References

- ICO Registration: https://ico.org.uk/for-organisations/register/
- Legitimate Interest Guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/legitimate-interests/
- LIA Template: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/accountability-framework/records-of-processing-and-lawful-basis/legitimate-interest-assessment-lia/

---

## Quick Reference: What We CAN and CANNOT Do

### CAN Do (with compliance steps above)
- Store owner names from Land Registry
- Store company details from Companies House
- Use tracing services to find contact details
- Display contact info to logged-in users
- Contact owners about property transactions

### CANNOT Do
- Sell contact data to third parties
- Use data for unrelated marketing
- Keep data indefinitely (24 month max)
- Ignore opt-out requests
- Process data without ICO registration
