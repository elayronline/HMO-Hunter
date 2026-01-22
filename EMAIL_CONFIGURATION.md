# Email Configuration Guide for HMO Hunter

## Issue: Confirmation Emails Not Sending

If sign-up confirmation emails are not being sent, this is typically due to Supabase email configuration settings.

## Solutions

### Option 1: Disable Email Confirmation (Development Only)

For development and testing, you can disable email confirmation in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Under **Email Settings**, toggle OFF "Confirm email"
4. Save changes

**Note:** Users will be auto-confirmed and can sign in immediately without email verification.

### Option 2: Configure Email Provider (Production)

For production, configure a proper email provider:

1. Go to Supabase Dashboard → **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Configure your email provider:
   - **SendGrid**
   - **AWS SES**
   - **Mailgun**
   - **Custom SMTP**

### Option 3: Use Supabase's Built-in Email (Testing)

Supabase provides a basic email service for testing:

1. Ensure your **Site URL** is correct in Project Settings → Auth
2. Add your redirect URLs to **Redirect URLs** list:
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`

## Current Implementation

The signup page now:
- ✅ Handles both confirmed and unconfirmed user states
- ✅ Shows proper redirect URL for email callbacks
- ✅ Provides debug logging with `console.log('[v0] ...')` 
- ✅ Auto-redirects if email confirmation is disabled
- ✅ Shows clear instructions for email verification

## Testing Email Flow

1. **Sign up** with a test email
2. Check browser console for debug logs
3. If emails aren't sending:
   - Check Supabase Auth logs
   - Verify Site URL is configured
   - Consider disabling email confirmation for development

## Redirect URL Configuration

The callback route is configured as:
```
/auth/callback
```

Make sure this is added to your Supabase **Redirect URLs** in:
- Project Settings → Auth → URL Configuration
