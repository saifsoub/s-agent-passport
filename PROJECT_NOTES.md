# S/ Agent Passport Demo — Working Notes (internal)

## Task
Build a webpage demonstrating the S/ Agent Passport v0.1 Python package for Seif.
Webdev static project: /home/ubuntu/s-agent-passport-demo (project title "S/ Agent Passport").
Dev preview: https://3000-ivm9t6fskvlfirktzyhkj-dfa17476.sg1.manus.computer
Design: "Border Control Terminal" per ideas.md (navy #0A1628, orange #FF4F00,
Space Grotesk + IBM Plex Mono, MRZ strips, rubber stamps, checkpoint metaphor).

## Package facts to demonstrate (from /home/ubuntu/s-agent-passport)
- AgentPassport pydantic model: passport_id (S-PASS-XXXX hex12), agent_name, agent_type
  (orchestrator/researcher/coder/executor/analyst/content_engine/domain_specialist/swarm_node/memory_bridge/custom),
  version 1.0.0, creator "Seif Alsoub / S/", issued_at, expires_at, capabilities[],
  permissions{}, memory_bridge_ref, calibration_level 0-7, provenance[], parent_passport_id,
  status (active/paused/revoked/archived/expired), branding{}, metadata{}, checksum (sha256 16-hex),
  signature + signer_public_key (Ed25519 opt-in).
- Methods: is_valid(), verify_checksum(), present_for_handoff(), spawn_child() with
  least-privilege enforcement (PrivilegeEscalationError), revoke(), transition() state machine,
  require(), append_provenance(), to_supabase_row().
- Gate: validate_handoff(payload, required_capabilities, required_permissions, registry,
  require_signature) → GateResult{ok, reason, checks{payload_shape, registry_lookup,
  status_active, not_expired, checksum, signature, capability:X, permission:Y}}.
- Registries: LocalRegistry (JSON), SupabaseRegistry (live table agent_passports in project
  nrjfbqgvigankejaajrt "DoneAi"). CLI: s-pass issue/list/inspect/verify/revoke/sweep/keygen/card.
- Deployed: US/SRV server /home/ubuntu/s-os/s-agent-passport, systemd s-pass-registry on
  127.0.0.1:8433 (bearer token), hourly sweep cron. 41 pytest tests green.
- Factories: issue_swarm_orchestrator (calibration 5, can_spawn_children), issue_content_engine
  (calibration 4), issue_swarm_node (6h TTL, calibration 2).
- Tagline: "Sovereign. Calibrated. Accountable."

## Plan
Phase 1: init + design (done: ideas.md, generating images)
Phase 2: implement page sections: hero checkpoint, schema booklet, issuance desk (interactive),
border gate validation demo, spawn lineage, lifecycle strip, integration annex (code samples).
All demo logic simulated client-side in TS mirroring the Python semantics (no MCP/backend).
Phase 3: screenshots + style review, checkpoint, deliver.

## Generated assets (fill in URLs after generation)
- hero background, guilloche texture, S/ logo: see chat context for URLs.


## Current task (2026-07-10, third iteration)
User request: (1) Owner page to request a passport + select tools; (2) private secrets
vault per owner (agent can use them on top of regular tools); (3) passport downloads in
2 formats: owner PDF document (full picture) + embeddable code version for agent code;
(4) soften the harsh orange.

Standing rule: NEVER mention FTA unless Seif explicitly says something is for the FTA.

Done so far:
- Orange softened globally: oklch(0.646 0.222 36.5) → oklch(0.68 0.145 45) (soft copper),
  chart variants toned, hex #FF4F00 → #D97742 in passport.ts/mockRegistry.ts branding.
- Created client/src/lib/ownerConsole.ts: TOOL_CATALOG (14 tools, groups research/data/
  content/execution/memory, sensitive ones carry permission flags), OwnerProfile,
  VaultSecret (localStorage LS keys: s_pass_owner, s_pass_vault, s_pass_requests),
  submitRequest() mints passport instantly (approved), buildEmbedBundle() → .py file,
  buildOwnerDocumentHtml() + openOwnerPdf() → print window PDF, downloadText helper,
  maskSecret.

TODO:
- Create OwnerConsole page at /owner route in App.tsx (wouter Route).
- Page sections: owner identity create/load, secrets vault CRUD (masked values, delete),
  request form (agent name, type select, purpose, TTL, tool checkboxes grouped w/
  sensitive flags, vault secret grant checkboxes), issued requests list w/ PassportCard,
  two download buttons per request (PDF doc via openOwnerPdf, embed bundle .py via
  downloadText(buildEmbedBundle)).
- Link from Home nav ("Owner Console" button) + hero CTA maybe.
- Screenshot verify desktop+mobile, checkpoint, deliver.
- Existing components to reuse: Section, PassportCard, Stamp, MrzStrip, Perforation from
  @/components/passport-ui; UI: Button, Input, Checkbox, sonner toast.
- Home.tsx nav has links schema/issue/gate/lineage/registry/annex; add /owner link.


## Fourth iteration (2026-07-10): TURN INTO REAL PRODUCT
User request: (1) separate/create a public commercial landing page ("tired of adding your
password over and over? issue a passport" vibe) that leads to the submission portal;
(2) portal = real backend; (3) gate = REAL approval flow (pending → admin approves/denies);
(4) no more mock — real DB.

STATUS: webdev_add_feature web-db-user COMPLETED. Template = tRPC 11 + Drizzle (MySQL) +
Manus OAuth. Key facts:
- Home.tsx was REPLACED by template stub (old demo page content was overwritten — the old
  demo page code with all sections still documented in git history; checkpoint 50ddd5b7).
- Auth: useAuth() from @/_core/hooks/useAuth, startLogin() from @/const (call in onClick).
  protectedProcedure gives ctx.user; adminProcedure pattern: check ctx.user.role !== 'admin'.
  users table has role enum user/admin; OWNER_OPEN_ID auto-becomes admin on login.
- DB: drizzle/schema.ts + pnpm db:push. server/db.ts helpers, server/routers.ts procedures.
- trpc client: trpc.*.useQuery/useMutation from @/lib/trpc.
- Vitest: server/*.test.ts, pnpm test. Required before delivery.

RECOVERY PLAN (files to create/restore):
1. git show 50ddd5b7 -- client/src/pages/Home.tsx > restore as client/src/pages/Demo.tsx
   (rename component Demo, route /demo, keep all interactive sections; remove nav Owner
   Console link → point to /portal).
2. New Landing at / : commercial S/ branded (navy + copper #D97742 oklch(0.68 0.145 45)),
   headline like "Tired of pasting your API keys over and over?", benefits (one credential,
   sealed vault, scoped tools, revoke anytime), how-it-works 3 steps, CTA → /portal,
   secondary link → /demo ("see it inspect"). Existing assets:
   /manus-storage/hero-checkpoint_653f00d7.png, passport-booklet_d06db170.png,
   s-slash-logo_80b146d9.png. Fonts: Space Grotesk + IBM Plex Mono (need re-add to
   client/index.html if template reset it).
3. Schema tables to add: vault_secrets (id, userId FK, keyName, valueEncrypted, createdAt),
   passport_requests (id, userId, agentName, agentType, toolIds JSON, secretKeys JSON,
   ttlHours, purpose, status enum pending/approved/denied, decidedBy, decidedAt, denialReason,
   createdAt), passports (id, passportId S-PASS-hex12, requestId FK, userId, payload JSON,
   checksum, signature, status enum active/revoked, issuedAt, expiresAt, revokedAt).
4. Routers: vault (list/add/delete - protected), requests (submit/listMine - protected;
   listAll/approve/deny - admin), passports (mine, download data). Passport minting logic
   port from client/src/lib/passport.ts (issuePassport, computeChecksum) to server/passport.ts.
   AES-256-GCM encrypt vault values with JWT_SECRET-derived key.
5. Pages: Landing (/), Portal (/portal - owner console on real trpc), Admin desk (/admin -
   adminProcedure gated, approve/deny pending), Demo (/demo). Update App.tsx routes.
6. Downloads: reuse client/src/lib/ownerConsole.ts buildEmbedBundle + buildOwnerDocumentHtml
   but source data from server passport records (adapt types).
7. index.css: theme already Border Control (dark navy + copper) — KEEP. ThemeProvider
   defaultTheme must stay "dark" in App.tsx (template may have reset to "light").
8. pnpm db:push, write vitest for approve flow, screenshot all pages, checkpoint.

Standing rule: NEVER mention FTA unless explicitly for the FTA.


## Progress log (real product build, 2026-07-10 13:47)
DONE so far:
- web-db-user upgrade complete, pnpm install done, db:push applied (tables: users,
  vault_secrets, passport_requests, passports confirmed in DB).
- drizzle/schema.ts: added vaultSecrets, passportRequests, passports tables.
- server/passport.ts: TOOL_CATALOG (14 tools), AGENT_TYPES, mintPassport (checksum
  sha256[:16] over id|name|type|creator|issued_at, S-PASS-{12hex}, provenance
  requested/approved/issued, HMAC-SHA256 signing keyed off JWT_SECRET,
  signer_public_key="hmac-sha256:s-pass-web-registry"), AES-256-GCM encrypt/decryptSecret
  (iv.tag.data base64), maskSecret.
- server/passportDb.ts: vault CRUD, request create/list/decide, passport insert/list/
  getByRequestId/revoke.
- server/routers.ts: catalog.tools/agentTypes (public), vault.list/add/remove (protected,
  KEY_NAME_RE ^[A-Z][A-Z0-9_]{1,63}$, max 50), requests.submit/mine, admin.pending/
  approve/deny/allPassports/revoke (adminProcedure role check), passports.mine/exportData
  (exportData returns payload + decrypted secretEnv for embed bundle).
- client/src/pages/Landing.tsx: commercial page done ("Tired of pasting your API keys
  over and over?", pain/how/benefits/final CTA, links /portal /demo /admin).
- client/src/pages/Demo.tsx: old demo restored (component Demo), nav link → /portal.
- client/src/pages/Home.tsx: still OLD demo content (stray useAuth line removed);
  PLAN: App.tsx routes / → Landing (change import Home→Landing), /demo → Demo, delete
  Home.tsx & OwnerConsole.tsx after Portal built.
- App.tsx: routes registered for /, /demo, /portal, /admin — Portal.tsx and AdminDesk.tsx
  DON'T EXIST YET (2 TS errors pending).

REMAINING:
1. Portal.tsx — rebuild OwnerConsole on trpc: auth via useAuth()+startLogin() from
   "@/const"; sections: owner file (auto from Manus login), vault (trpc.vault.*),
   request form (trpc.catalog.tools, trpc.requests.submit), my applications
   (trpc.requests.mine, show pending/approved/denied stamps), my passports
   (trpc.passports.mine) with dual downloads using trpc.passports.exportData →
   client/src/lib/passportExports.ts (port buildEmbedBundle + buildOwnerDocumentHtml from
   ownerConsole.ts lines 183-406, adapt to PassportPayload type from server; embed bundle
   includes real env values in comments? NO — keep names only in PDF; embed bundle has
   export lines with actual values fetched via exportData.secretEnv).
2. AdminDesk.tsx — trpc.admin.pending list with APPROVE/DENY stamps (deny requires
   reason dialog), allPassports table with revoke; gate by useAuth().user?.role==='admin',
   show DENIED stamp page for non-admins.
3. App.tsx: swap Home import → Landing for "/" route.
4. Update Demo.tsx nav: it has Link /portal already (done via sed).
5. Vitest: server/passport.test.ts (mint/checksum/sign/encrypt roundtrip, approve flow
   with mocked db? — at minimum crypto + minting pure functions).
6. tsc clean, screenshots (/, /portal, /admin, /demo), checkpoint, deliver.
Design tokens: font-display=Space Grotesk, font-mono=IBM Plex Mono, label-mono/panel/
doc-corners/stamp/mrz/perforation/slash-watermark/rise-in/btn-press classes in index.css.
Copper primary. ThemeProvider defaultTheme="dark" (done in App.tsx).


## Verification status (13:55)
- 13/13 vitest pass (passport.test.ts 12 + auth.logout 1). tsc 0 errors.
- Screenshots: / (landing renders great), /demo renders fully.
- /portal and /admin show only the auth loading spinner in screenshots — expected:
  useAuth loading state while trpc auth.me resolves without session cookie in the
  screenshot browser. Portal shows login panel when auth resolves unauthenticated.
  Need to verify the loading state doesn't hang: auth.me is publicProcedure returning
  null; useAuth loading should flip false. If spinner persists → check useAuth hook.
- Remaining: verify portal/admin non-auth render OK, checkpoint + deliver.


## Fifth iteration (2026-07-10 ~14:15): ACCESS SEPARATION + LANDING + DASHBOARD + BIOMETRICS
Checkpoint before this work: 2749031e (browser E2E verified; test data cleaned).
SITE IS PUBLISHED: s-agent-passport.manus.space + sagentpass-kzcdvsjy.manus.space.

User requests:
1. Access separation — owners currently see links to pages they shouldn't (Approval Desk
   link in Portal nav visible to all; Landing footer may link /admin). Fix: render admin
   links only when useAuth().user?.role === 'admin'. AdminDesk already server-gated
   (adminProcedure) + shows denied UI, but links must disappear for non-admins.
2. Enhance the landing page (stronger commercial design/content).
3. Owner dashboard — passports at a glance, vault status, application history, quick
   actions. Likely new /dashboard route (DashboardLayout not required — public product;
   keep custom nav) or restructure Portal with an overview header section.
4. Biometric auth option (Face ID / fingerprint) = WebAuthn passkeys, OPT-IN, for owner
   safety. Plan: pnpm add @simplewebauthn/server @simplewebauthn/browser; passkeys table
   (id, userId, credentialId unique, publicKey text, counter, transports, createdAt,
   label); users.vaultLockEnabled boolean (or separate settings); challenge stored
   server-side short-lived (in-memory Map or DB table with expiry); routers: passkeys.
   registerOptions/registerVerify/authOptions/authVerify/list/remove + setting toggle;
   gate: vault value reveal + exportData (.env/embed downloads) require recent passkey
   verification (e.g. verifiedAt within 5 min in a signed cookie or server session map)
   when user has vaultLockEnabled.
Phases: 1 access separation → 2 landing → 3 dashboard → 4 webauthn → 5 test/checkpoint/deliver.


## Fifth iteration progress (14:25)
- Phase 1 DONE: Landing footer /admin link removed; Portal nav already gated by
  user?.role==='admin'; AdminDesk shows RESTRICTED AREA denied page for non-admins,
  queries enabled:isAdmin only; Demo has no admin links.
- Phase 2 DONE: Landing.tsx rewritten (v2): hero + right-side credential mock card
  (S-PASS-7C41E9A2B0D8), proof strip (AES-256-GCM/1 stamp/Instant/Face ID), pain,
  how-it-works, benefits, NEW security section (4 cards incl. biometric vault lock)
  + checklist row, NEW FAQ (5 items, FaqItem accordion with useState), final CTA,
  footer (demo/portal only). tsc 0 errors. Needs screenshot verify.
- Phase 3 NEXT: Owner dashboard — plan: add overview/dashboard section at top of
  /portal (it already fetches vault+requests+passports): stat tiles (active passports,
  sealed secrets, pending applications), recent activity list, quick action buttons
  (seal secret → #vault, new application → #apply). Alternatively separate /dashboard
  route. DECISION: integrate as Portal top "Command deck" section — avoids nav
  duplication; Portal IS the owner space.
- Phase 4: WebAuthn passkeys per plan in earlier notes (@simplewebauthn/server+browser,
  passkeys table, users.vaultLockEnabled or settings, challenge map, gate exportData +
  vault reveal).
- dotenv error in devserver.log is STALE (13:36, pre-pnpm-install); tsc watch clean.
- Site published: s-agent-passport.manus.space. Latest checkpoint 2749031e.


## Portal.tsx structure facts (for dashboard + biometric integration)
- Portal renders (after auth): header nav (Vault/Apply/Applications + admin-only Approval desk link)
  → "Owner file" section (~line 230, panel with name + counts + File open stamp)
  → #vault section → Perforation → #apply section → Perforation → #applications section.
- Queries: vaultQ=trpc.vault.list, requestsQ=trpc.requests.mine (each r may have r.passport
  {id, passportId, status}). secrets/requests/pendingCount computed at ~193-195.
- Downloads: doDownload(passportRowId, "pdf"|"embed"|"env") uses utils.passports.exportData.fetch.
- passportExports helpers: buildEmbedBundle, buildEnvFile, buildOwnerDocumentHtml, downloadText, openPrintableDoc.
- statusStampTone(s) helper at top. Icons imported from lucide.
- Dashboard plan: replace "Owner file" section with fuller "Command deck": stat tiles
  (active passports = requests where r.passport?.status==='active'; sealed secrets; pending apps),
  quick actions (jump #vault/#apply), recent activity (latest requests by createdAt).
- Schema: NO passkeys table, NO vaultLockEnabled yet (greenfield). routers.ts has no settings/passkeys.
- server/passport.ts has AES-256-GCM encryptSecret/decryptSecret/maskSecret; HMAC signing via JWT_SECRET.
- App.tsx routes: / Landing, /demo Demo, /portal Portal, /admin AdminDesk, 404. Dark theme.
- WebAuthn plan: pnpm add @simplewebauthn/server @simplewebauthn/browser; passkeys table
  (id, userId, credentialId varchar(255) unique, publicKey text, counter bigint, transports varchar,
  label, createdAt); users.vaultLockEnabled boolean default false (add column);
  challenges: in-memory Map<userId, {challenge, expires}> in server/webauthn.ts (fine for single instance);
  routers: passkeys.registerOptions/registerVerify/authOptions/authVerify/list/remove/setVaultLock;
  gate: vault.reveal + passports.exportData check recent verification (Map<userId, verifiedAtMs>, 5 min TTL)
  when user.vaultLockEnabled. rpID from req host; origin from req.


## WebAuthn progress (14:29)
- pnpm add @simplewebauthn/server @simplewebauthn/browser DONE (13.3.2).
- schema.ts: passkeys table + users.vaultLockEnabled int default 0 ADDED, db:push OK
  (passkeys 11 cols verified in live DB, users.vaultLockEnabled exists).
- server/webauthn.ts WRITTEN: startRegistration/finishRegistration,
  startAuthentication/finishAuthentication, vaultLockBlockReason(userId),
  listPasskeys/removePasskey (auto-disables lock when last removed),
  setVaultLock (requires >=1 passkey), rpFromRequest(req)->{rpID,origin},
  in-memory challenge maps + recentVerifications (5 min window).
  simplewebauthn v13 API: registrationInfo.credential.{id,publicKey,counter,transports},
  verifyAuthenticationResponse takes `credential:` param. credentialId stored base64url string.
- NEXT (routers.ts): add security router:
  security.passkeys.list / registerOptions(mutation) / registerVerify(mutation {response,label})
  / authOptions(mutation) / authVerify(mutation {response}) / remove({id}) /
  setVaultLock({enabled}) / status(query -> {vaultLockEnabled, unlocked, passkeyCount}).
  Use ctx.req headers via rpFromRequest. protectedProcedure all.
- GATE: in passports.exportData and vault router (list returns masked — gate NOT needed there;
  gate exportData only) call vaultLockBlockReason(ctx.user.id); throw TRPCError FORBIDDEN w/ reason.
- CLIENT (Portal.tsx): add Security section (id="security") after applications:
  passkey enroll (label input + Enroll button -> @simplewebauthn/browser startRegistration),
  list passkeys w/ remove, vault lock toggle (Switch), and in doDownload catch FORBIDDEN
  containing "Vault lock" -> trigger authOptions+startAuthentication+authVerify then retry.
  Also add nav link "Security". useAuth user has vaultLockEnabled? (auth.me returns ctx.user row).
- Tests: add server/webauthn.test.ts basic unit tests for challenge/gate logic (markVerified,
  isRecentlyVerified, setVaultLock w/o passkey fails).
- Landing page already advertises Face ID in proof strip + security section (accurate once shipped).
- Checkpoint b59d7c72 = dashboard+landing+access separation. Domains: s-agent-passport.manus.space.


## WebAuthn progress (14:32) — server+client DONE
- routers.ts: security router ADDED (status/registerOptions/registerVerify/authOptions/
  authVerify/removePasskey/setVaultLock); passports.exportData now gated via
  vaultLockBlockReason -> FORBIDDEN "Vault lock is on — verify...".
- Portal.tsx: Security section id="security" added after applications (enroll passkey w/ label,
  list w/ remove, vault lock Switch, Verify now & unlock button); nav link "Security" added;
  doDownload wraps fetchExportWithUnlock (catches "Vault lock" FORBIDDEN -> verifyPasskey -> retry).
  Uses @simplewebauthn/browser {optionsJSON}. tsc 0 errors.
- REMAINING: server/webauthn.test.ts unit tests (setVaultLock w/o passkey fails, gate logic,
  markVerified/isRecentlyVerified); run pnpm test (existing 14 must stay green);
  screenshot /portal (unauth ok; authed via preview cookie — screenshot tool uses preview session
  where Seif is logged in); update todo.md items; checkpoint; deliver.
- Note: webauthn ceremony itself can't be browser-tested in sandbox (no authenticator);
  verify UI renders + endpoints respond; state that honestly in delivery.
- dotenv console error is STALE (13:36, pre-pnpm-install). Domains live:
  s-agent-passport.manus.space + sagentpass-kzcdvsjy.manus.space (user bound them).
- Checkpoint b59d7c72 = phases 1-3. todo.md lines 45-48 = this iteration.
