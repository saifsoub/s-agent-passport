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
