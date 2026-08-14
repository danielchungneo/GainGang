# Feature TODO — Running List

**Last updated:** 2026-08-13

Living checklist of planned product features. Mark items done as they ship; add new ideas at the bottom under **Backlog**.

---

## In progress / planned

### Stats & exercises

- [x] Exercise art — create art and integrate across the app (exercise select, workout-mode rep transitions, exercise displays, etc.)
- [x] Better weekly planning
- [ ] Recommended weekly workout plans
- [ ] Cleaner / compressed tutorial videos

### Economy

- [x] Rename Cred top-ups → Hustle / Beast / Apex Bundles
- [x] In-game purchases (IAP) — staging first, then production
  - [x] App + Staging Supabase grant path (`react-native-purchases`, `fulfill-iap`, `revenuecat-webhook`)
  - [x] Create consumable products in App Store Connect + Play Console
  - [x] Configure RevenueCat offerings + webhook + secrets against **Staging** (see `docs/IAP_SETUP.md`)
  - [x] Add `EXPO_PUBLIC_REVENUECAT_*` keys to env and rebuild dev client
  - [x] Sandbox purchase test end-to-end on Staging
  - [x] Deploy edge functions + secrets to Production (only after Staging works)



### Store / listing

- [x] Update App Store pictures



### Companions

- [ ] Companions
- [ ] Figure out 3D model rendering

---



## Backlog

*Add new feature ideas below as they come up.*