# App updates (OTA + store force-update)

GainGang has **two** update paths. They are independent.

| Path | What changes | How users get it | Blocks app? |
|---|---|---|---|
| **EAS OTA** (`expo-updates`) | JS / assets | `eas update` on a channel | Yes — `OtaUpdateModal` |
| **Store force-update** | Native binary | App Store / Play Store | Yes — only when you raise the min version in DB |

---

## When to use which

- **JS-only / config / most bugfixes** → publish an OTA. No store submit. No DB change.
- **New native module, permission, SDK bump, or anything that needs a new binary** → ship a store build (`app.json` / EAS version bump), then optionally force old binaries off.
- **Force everyone onto a store version** → update `app_settings.force_update` in Supabase (see below). Do **not** bump this for every normal release.

You do **not** need to change the DB every time you publish to the store. Only change it when the old binary must stop working.

---

## Store force-update

### How it works

1. On launch (and when returning to foreground), the app reads `public.app_settings` where `key = 'force_update'`.
2. It compares `Constants.nativeApplicationVersion` (the **store** marketing version) to `min_ios_version` / `min_android_version`.
3. If installed `<` minimum, `ForceStoreUpdateModal` blocks the UI and opens the store listing.
4. If the remote fetch fails, the client falls back to `DEFAULT_MIN_STORE_VERSION` in `lib/force-update.ts` (currently `1.0.1`).
5. Skipped in `__DEV__`.

Anon clients can read this row (RLS policy `app_settings_select_force_update_anon`) so the gate works before sign-in.

### Config shape (`app_settings.value`)

```json
{
  "min_ios_version": "1.0.1",
  "min_android_version": "1.0.1",
  "ios_store_url": "https://apps.apple.com/us/app/gain-gang/id6792023328",
  "android_store_url": "https://play.google.com/store/apps/details?id=com.danielchungneo.gaingang",
  "message": "A new version of GainGang is required. Update from the store to continue."
}
```

### Raise the minimum (example: force `1.0.2`)

Run against **production** (and staging if you want them aligned):

```sql
update public.app_settings
set
  value = jsonb_set(
    jsonb_set(value, '{min_ios_version}', '"1.0.2"'),
    '{min_android_version}',
    '"1.0.2"'
  ),
  updated_at = now()
where key = 'force_update';
```

Or replace the whole object:

```sql
update public.app_settings
set
  value = '{
    "min_ios_version": "1.0.2",
    "min_android_version": "1.0.2",
    "ios_store_url": "https://apps.apple.com/us/app/gain-gang/id6792023328",
    "android_store_url": "https://play.google.com/store/apps/details?id=com.danielchungneo.gaingang",
    "message": "A new version of GainGang is required. Update from the store to continue."
  }'::jsonb,
  updated_at = now()
where key = 'force_update';
```

Checklist before raising the floor:

1. The new version is **live** on the store(s) you care about.
2. Production (and staging, if used) `force_update` mins are updated.
3. Optionally bump `DEFAULT_MIN_STORE_VERSION` in `lib/force-update.ts` on the next OTA so offline clients still get a sensible floor.

Migration that seeded this: `supabase/migrations/0031_force_update_setting.sql`.

### Code map

| Piece | Path |
|---|---|
| Version compare + fetch | `lib/force-update.ts` |
| Hook | `hooks/use-force-store-update.ts` |
| Blocking UI | `components/force-store-update-modal.tsx` |
| Wired in root | `app/_layout.tsx` (`ForceStoreUpdateModal`) |

---

## EAS OTA updates

- Hook: `hooks/use-ota-update.ts`
- Modal: `components/ota-update-modal.tsx` (mandatory when an update is available)
- Publish:

```bash
npm run update:preview      # preview channel
npm run update:production   # production channel
```

OTA cannot replace a missing native binary. If users are stuck on an old store build that cannot run the new JS, use **store force-update** after the binary is on the store.

**Important:** force-update logic that must reach users still on an old binary needs an OTA (or a store build they already have) that includes this client code. Raising the DB min alone does nothing for clients that never received the gate.
