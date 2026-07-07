# Google Sign-In — TODO

**Status:** Paused (UI disabled as of 2026-07-07)

Google sign-in is implemented in code but temporarily hidden on the sign-in and sign-up screens until Supabase/Google dashboard configuration is fixed.

## Current state

### Done (code)

- `lib/google-auth.ts` — Supabase OAuth flow via `expo-web-browser`, redirect URI `gaingang://auth/callback`
- `components/google-sign-in-button.tsx` — button, divider, and `useGoogleAuth` hook
- `app/auth/callback.tsx` — deep-link handler for OAuth cold starts
- `app.json` — app scheme `gaingang`
- `.env.example` — setup notes for Supabase + Google
- `google-auth-client-secret.json` — local Web OAuth client credentials (gitignored)

### Disabled (frontend)

- `app/(auth)/sign-in.tsx` — Google button, divider, and hook commented out
- `app/(auth)/sign-up.tsx` — Google button, divider, and hook commented out

Search for `TODO(google-auth)` to find re-enable points.

### Known issue (blocking)

Supabase auth logs show:

```
oauth2: "invalid_client" "The provided client secret is invalid."
```

The OAuth flow reaches Google and returns to Supabase, but Supabase fails when exchanging the authorization code. The app surfaces this as `unexpected_failure`.

**Root cause:** The Google **client secret** in Supabase Dashboard does not match the Web application OAuth client in Google Cloud Console (wrong value, regenerated secret, or ID/secret mismatch).

## What's left

### 1. Fix Supabase ↔ Google configuration

1. **Google Cloud Console** → APIs & Services → Credentials → **Web application** OAuth client
   - Authorized redirect URI: `https://uqgzzpxujaxgodfduczb.supabase.co/auth/v1/callback`
   - Copy the current **Client ID** and **Client secret**

2. **Supabase Dashboard** → Authentication → Providers → **Google**
   - Paste the Web client ID and secret (must be from the same OAuth client)
   - Enable the provider

3. **Supabase Dashboard** → Authentication → URL Configuration → **Redirect URLs**
   - `gaingang://auth/callback`
   - Dev URL from Metro log `[Auth] OAuth redirect URI:` when testing in Expo Go (if applicable)

### 2. Re-enable the UI

1. Uncomment Google imports and `useGoogleAuth` in:
   - `app/(auth)/sign-in.tsx`
   - `app/(auth)/sign-up.tsx`
2. Uncomment `<GoogleSignInButton />` and `<AuthDivider />` in both files
3. Restore `disabled={isSubmitting || isGoogleLoading}` on submit buttons

### 3. Verify end-to-end

- [ ] Tap "Continue with Google" on sign-in and sign-up
- [ ] Complete Google account picker / consent
- [ ] Land in `/(tabs)` with a confirmed session
- [ ] Confirm `isAppSession` passes (Google users should have `email_confirmed_at` set)
- [ ] Test cold-start deep link via `auth/callback` if needed

### 4. Optional improvements

- Map `unexpected_failure` and other OAuth `error_code` values to user-friendly messages in `lib/google-auth.ts`
- Add integration test or manual test checklist to CI/docs

## Relevant files

| File | Purpose |
|------|---------|
| `lib/google-auth.ts` | OAuth implementation |
| `components/google-sign-in-button.tsx` | UI + hook |
| `app/auth/callback.tsx` | Deep-link callback route |
| `lib/auth-session.ts` | `isAppSession` / email confirmation gate |
| `google-auth-client-secret.json` | Local Google Web client JSON (do not commit) |
