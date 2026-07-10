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
