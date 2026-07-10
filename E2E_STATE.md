# E2E verification state (2026-07-10 14:00)

## Done
- 14/14 vitest green including server/flow.integration.test.ts (full router flow
  against live DB: vault seal→request→approve mints S-PASS→export with real vault
  values→deny w/ reason→revoke→cleanup). tsc 0 errors.
- Dual download wiring verified by code inspection: Portal.tsx L127-138 calls
  utils.passports.exportData.fetch then buildOwnerDocumentHtml (print→PDF),
  buildEmbedBundle (.py), buildEnvFile (.env).
- Checkpoint 4efefdb6 saved (pre-integration-test).

## In progress: browser E2E on /portal
- Portal login panel renders correctly (unauthenticated state verified).
- Clicked IDENTIFY YOURSELF → manus.im OAuth → clicked Continue with Google →
  Google accounts sign-in page asking for email (sandbox browser has no Google
  session for this app). CANNOT complete login without user credentials.
- Earlier network log (13:54) showed Seif logged in via the PREVIEW panel
  (auth.me returned Seif, role admin, url 127.0.0.1:3000/admin) — so real auth
  works in the user's preview; the sandbox browser just lacks a session.

## Decision
- Don't ask user to take over for login; the auth flow is Manus OAuth (template
  built-in, already proven working via preview session logs at 13:54:59 where
  auth.me returned Seif as admin on /admin).
- Alternative verification: procedures fully exercised in integration test.
  Remaining browser-only bits (button clicks) are thin wrappers over the same
  tRPC mutations.
- Plan: close browser attempt, note limitation honestly in delivery, ask Seif
  to test portal flows in the preview (he's already logged in there).

## Remaining todos
- [ ] Browser E2E on /portal (blocked by login; verified via preview logs + integration test)
- [ ] Verify download outputs from UI (blocked same; export data path covered by test)
- [ ] Final checkpoint + delivery message

## Key facts for delivery message
- Landing / (commercial, "Tired of pasting your API keys over and over?")
- /portal owner portal: Manus OAuth, AES-256-GCM vault, request flow, dual downloads
- /admin approval desk: adminProcedure gated, approve mints signed S-PASS-XXXX,
  deny with reason, revoke
- /demo old Border Control demo preserved
- DB tables: vault_secrets, passport_requests, passports (MySQL/TiDB via Drizzle)
- Tests: 14/14 (12 unit passport + 1 auth + 1 full integration)
- Seif's user is already admin (role=admin, openId CFBRo7JwYugivniGePkF97)
