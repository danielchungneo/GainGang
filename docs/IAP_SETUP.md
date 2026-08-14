# In-app purchases — Cred bundles

Consumable top-ups sold as **Hustle / Beast / Apex** bundles via App Store + Google Play, orchestrated by **RevenueCat**.

## Products

| Bundle | Creds | Store product ID | Fallback price |
|---|---:|---|---|
| Hustle Bundle | 500 | `com.danielchungneo.gaingang.creds.hustle` | $0.99 |
| Beast Bundle (best value) | 6,500 | `com.danielchungneo.gaingang.creds.beast` | $9.99 |
| Apex Bundle | 15,000 | `com.danielchungneo.gaingang.creds.apex` | $19.99 |

Keep these IDs identical in App Store Connect, Play Console, RevenueCat, `lib/shop.ts`, and `grant_iap_creds` SQL.

## Architecture

1. App configures RevenueCat (`PurchasesBootstrap`) with public SDK keys and `logIn(supabaseUserId)`.
2. Purchase UX is **only** the in-app Cred Bundles sheet (Hustle / Beast / Apex). Nothing is locked behind payment.
3. After a store purchase, the app calls `fulfill-iap`, which reads the RevenueCat subscriber and grants Creds via `grant_iap_creds`.
4. RevenueCat webhook `revenuecat-webhook` is the backup path (same grant, idempotent on `store_transaction_id` / `revenuecat_event_id`).
5. Optional: **Restore** and **Purchase help** (RevenueCat Customer Center) — support only, never a gate.

Never trust the client for Cred amounts — product → amount lives only in SQL.

### No paywall / no Pro gate

RevenueCat’s onboarding prompt often mentions a “Paywall” and a “Pro” entitlement. Those are for subscription apps that lock features.

GainGang only sells **optional consumable Creds**. Users can play the full app without buying. Do **not** create a Pro entitlement or attach a RevenueCat Paywall unless you later add a real subscription product.

## Staging first

Code + Staging DB + Staging edge functions (`fulfill-iap`, `revenuecat-webhook`) are in place.
**Do not wire Production webhooks/functions until Staging sandbox purchases work.**

Staging webhook URL:
`https://otgwritdvqzutsvqrpdl.supabase.co/functions/v1/revenuecat-webhook`

## Checklist (you do this in dashboards)

### 1. App Store Connect

1. Open the GainGang app (`com.danielchungneo.gaingang`).
2. Monetization → In-App Purchases → create three **Consumable** products with the IDs above.
3. Set reference names (Hustle / Beast / Apex), localized display names, and prices.
4. Submit the IAPs with your next binary (or attach to an existing version for review).
5. Create a Sandbox Apple ID for testing.

### 2. Google Play Console

1. Monetize → In-app products → create three **Managed / Consumable** products with the same IDs.
2. Activate them and set prices.
3. Add license testers for sandbox purchases.

### 3. RevenueCat

1. Create a project; add iOS + Android apps with the GainGang bundle / package IDs.
2. Connect App Store Connect API key + Play service account so RC can validate receipts.
3. Import / create the three products (exact IDs above) as **consumables**.
4. Create an Offering (e.g. `default` / `creds`) and add three packages pointing at those products.
5. Skip entitlements / Paywalls — not needed for optional Cred top-ups.
6. Copy the **public** SDK keys:
   - iOS → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (`appl_…` or Test Store `test_…`)
   - Android → `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` (`goog_…` or `test_…`)
7. Copy the **secret** API key (`sk_…`, **V2**) → Supabase secret `REVENUECAT_SECRET_API_KEY` (staging only for now).
   Also set `REVENUECAT_PROJECT_ID` to the `proj…` id from your RevenueCat dashboard URL.
8. Integrations → Webhooks (Staging first):
   - Staging URL: `https://otgwritdvqzutsvqrpdl.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: pick a long random string (e.g. `Bearer gg_rc_wh_…`) and set the **same** value as Supabase secret `REVENUECAT_WEBHOOK_AUTH`.
   - Events: at least `NON_RENEWING_PURCHASE` (sandbox + production).
9. Optional: enable Customer Center for purchase help / restore support.

### 4. Supabase secrets

In **both** Staging and Production projects → Edge Functions → Secrets:

| Secret | Purpose |
|---|---|
| `REVENUECAT_SECRET_API_KEY` | `fulfill-iap` verifies purchases via RC REST API (V2 `sk_…` key) |
| `REVENUECAT_PROJECT_ID` | Project id from dashboard URL (`proj…`) — required for V2 secret keys |
| `REVENUECAT_WEBHOOK_AUTH` | Exact `Authorization` header RC sends to `revenuecat-webhook` |

V2 secret key permissions (read-only):
- `customer_information:customers:read`
- `customer_information:purchases:read`
- `project_configuration:products:read`

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are already provided to functions.

### 5. App env / EAS

Add to `.env.local` (dev) and EAS env for preview/production builds:

```
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_…
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_…
```

Rebuild a **dev client** after adding `react-native-purchases` / `react-native-purchases-ui` (native modules — OTA alone is not enough).

### 6. Test

1. Sign in on a physical device with a sandbox / license tester account.
2. Open Cred Bundles → buy Hustle.
3. Confirm Creds land on the HUD and a row appears in `iap_purchases`.
4. Buy again (consumable) and confirm a second grant.
5. Try Settings → **Restore purchases** if a buy doesn’t credit immediately.
6. Cancel a purchase sheet and confirm no error toast.

## Code map

| Piece | Location |
|---|---|
| Pack catalog + product IDs | `lib/shop.ts` (`CREDS_PACKS`) |
| RevenueCat client (consumable buys, restore, help) | `lib/iap.ts` |
| Hooks | `hooks/use-iap.ts` |
| Identity bootstrap | `components/purchases-bootstrap.tsx` |
| Cred purchase UI | `components/shop-sheets.tsx` (`ShopCredsPacksSheet`) |
| Restore / purchase help | `app/settings.tsx` |
| DB grant | `supabase/migrations/0076_iap_award_kind.sql`, `0077_iap_creds.sql`, `0078_hustle_bundle_500.sql` |
| Webhook | `supabase/functions/revenuecat-webhook` |
| Client fulfill | `supabase/functions/fulfill-iap` |
