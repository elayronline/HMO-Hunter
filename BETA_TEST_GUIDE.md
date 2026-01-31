# HMO Hunter Beta Test Guide

Manual testing checklist for beta testers. Work through each section and note any issues.

---

## 1. Authentication Flow

### 1.1 Sign Up (New User)
1. Go to `/auth/signup`
2. Enter a valid email and password (min 8 characters)
3. Click "Sign up"
4. **Expected:** Success message, verification email sent
5. Check email inbox for verification link
6. Click verification link
7. **Expected:** Redirected to app, logged in

### 1.2 Login
1. Go to `/auth/login`
2. Enter credentials
3. Click "Sign in"
4. **Expected:** Redirected to homepage, user icon shows in header

### 1.3 First Login Walkthrough
1. On first login, walkthrough modal should appear
2. Click through all 6 steps (Welcome → Map → Filters → Details → Save → Get Started)
3. **Expected:** Modal closes, doesn't appear on next login

### 1.4 Logout
1. Click user icon in header
2. Click "Sign out"
3. **Expected:** Redirected to homepage, "Sign in" button shows

### 1.5 Password Reset
1. Go to `/auth/login`
2. Click "Forgot password?"
3. Enter your email
4. Click "Send reset link"
5. **Expected:** Success message shown
6. Check email for reset link
7. Click link, enter new password
8. **Expected:** Success, redirected to login

---

## 2. Map & Property Search

### 2.1 Map Loading
1. Go to homepage `/`
2. **Expected:** Map loads with property pins
3. **Check:** Green pins (licensed), Blue pins (potential), other colors per legend

### 2.2 Property Pins
1. Click any pin on the map
2. **Expected:** Property card appears OR right sidebar opens with details
3. **Check:** Property title, bedrooms, HMO status visible

### 2.3 Postcode Search
1. Enter a postcode in search bar (e.g., "M1", "B1", "BS1")
2. Press Enter or click search
3. **Expected:** Map zooms to that area, properties load

### 2.4 City Selection
1. Use city dropdown (if available)
2. Select different city
3. **Expected:** Map moves to new city, properties update

---

## 3. Filter Tabs

### 3.1 Category Filters
Test each tab above the map:
- [ ] **All** - Shows all properties
- [ ] **Licensed** - Shows only licensed HMOs (green pins)
- [ ] **Opportunities** - Shows potential HMOs
- [ ] **Restricted** - Shows Article 4 areas (if any)

### 3.2 Sidebar Filters
1. Open left sidebar (filter icon)
2. Adjust price range slider
3. **Expected:** Properties update based on filter
4. Toggle other filters (bedrooms, etc.)

---

## 4. Property Details

### 4.1 Property Card
1. Click a property pin
2. **Expected:** Card shows with:
   - Property image (or placeholder)
   - Title and address
   - Bedrooms count
   - HMO status badge
   - "Book Viewing" or "View Full Details" button

### 4.2 Full Details Modal
1. Click "Full Details" on a property card
2. **Expected:** Full modal opens with:
   - Image gallery
   - All property specs
   - Tabs (Overview, Details, Compliance, Analysis)
   - Agent contact card (or fallback)

### 4.3 Book Viewing Button
1. Click "Book Viewing" button
2. **Expected:**
   - If agent phone exists: Opens phone dialer
   - If source URL exists: Opens original listing in new tab
   - If neither: Shows alert message

---

## 5. Save Properties

### 5.1 Save a Property
1. Click bookmark icon on any property card
2. **Expected:** Icon fills/highlights, property saved

### 5.2 View Saved Properties
1. Go to `/saved` (via menu or direct URL)
2. **Expected:** List of saved properties appears

### 5.3 Unsave a Property
1. Click bookmark icon on a saved property
2. **Expected:** Icon unfills, property removed from saved list

---

## 6. Premium Features

### 6.1 Free User View
1. Log in as free user (no premium flag)
2. View a property with owner data
3. **Expected:** "Title Owner & Licence Holder" section shows:
   - Lock icon
   - "Premium Feature" badge
   - Blurred/hidden data

### 6.2 Premium User View
1. Log in as premium user (set via admin endpoint)
2. View same property
3. **Expected:** Owner information fully visible (if data exists)

---

## 7. Help & Support

### 7.1 Help Page
1. Click user icon → "Help"
2. **Expected:** Help page loads with FAQ sections
3. Click accordion items to expand/collapse

### 7.2 Help Page Navigation
1. Click "Back to Map" button
2. **Expected:** Returns to homepage

---

## 8. Mobile Responsiveness

### 8.1 Mobile Layout
1. Open app on mobile device OR resize browser to mobile width
2. **Check:**
   - [ ] Header collapses appropriately
   - [ ] Map is usable
   - [ ] Sidebars collapse/expand
   - [ ] Property cards are readable
   - [ ] Buttons are tappable

---

## 9. Edge Cases

### 9.1 No Properties Found
1. Search for obscure postcode with no properties
2. **Expected:** Appropriate "no properties" message

### 9.2 Session Expiry
1. Leave app idle for extended period
2. Try to interact
3. **Expected:** Graceful redirect to login if session expired

### 9.3 Network Error
1. Disconnect internet briefly
2. Try to load properties
3. **Expected:** Error message, not blank screen

---

## Issue Reporting

For each issue found, note:
- **Page/Feature:** Where the issue occurred
- **Steps:** How to reproduce
- **Expected:** What should happen
- **Actual:** What actually happened
- **Screenshot:** If applicable

---

## Quick Links

- Homepage: `/`
- Login: `/auth/login`
- Sign Up: `/auth/signup`
- Saved: `/saved`
- Help: `/help`
- Privacy: `/privacy`

---

*Last updated: January 2026*
