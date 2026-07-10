# Project TODO

- [x] Border Control Terminal demo page (hero, schema, issuance desk, gate, lineage, lifecycle, annex)
- [x] Remove all FTA references (standing rule: never mention FTA unless explicit)
- [x] Live Registry section with mock fleet grid + filters
- [x] Owner Console page (localStorage version) with vault, request form, dual downloads
- [x] Soften orange to copper #D97742

## Real product upgrade (2026-07-10)
- [x] Full-stack upgrade (web-db-user) — install deps, resolve template conflicts, dev server green
- [x] Preserve old demo page as /demo (restore from checkpoint 50ddd5b7)
- [x] DB schema: vault_secrets, passport_requests, passports tables + pnpm db:push
- [ ] Server passport minting logic (checksum, S-PASS id, sign) in server/passport.ts
- [ ] Vault values encrypted at rest (AES-256-GCM)
- [ ] tRPC routers: vault, requests (submit/mine), admin (listAll/approve/deny), passports
- [ ] Commercial public landing page at / with conversion copy + CTA to portal
- [ ] Portal page /portal: real auth (Manus OAuth), vault, passport request flow
- [ ] Admin approval desk /admin (adminProcedure gated) — approve mints real passport, deny with reason
- [ ] Dual downloads wired to real passport records (PDF document + embeddable .py)
- [ ] Vitest coverage for approve/deny/mint flow
- [ ] Screenshots all pages, checkpoint, deliver
