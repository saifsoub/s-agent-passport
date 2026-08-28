# S/Integrator Passport Policy

## Decision

S/Passport is the first trust layer for integrations.

- If a platform already has a built-in integration, keep it.
- Attach S/Passport as the identity, ownership, scope, and audit layer.
- If no integration exists, S/Passport must be presented before access is established.
- S/Passport does not replace native integrations; it governs them.
- A valid Passport settles identity first; connector mechanics come second.

## S/Integrator

S/Integrator is the single integration control layer for Seif-owned platforms and accounts.

It receives its own Passport and acts as the governed integration identity across connectors.

### Operating model

1. **Passport first** — verify the S/Integrator Passport.
2. **Native integration second** — reuse an existing built-in connector when available.
3. **Passport metadata overlay** — bind owner, platform, scopes, permissions, expiry, and audit references to that integration.
4. **Fallback path** — when no native integration exists, require Passport presentation before creating a connector path.
5. **No forced rewiring** — an existing working integration remains intact unless an explicit migration is approved.

## Trust hierarchy

`Owner -> S/Integrator Passport -> Integration/Connector -> Platform`

Native platform credentials and OAuth grants remain platform-native. S/Passport records the governed identity and allowed scope around them.

## Required Passport metadata for S/Integrator

- `agent_name`: `S/Integrator`
- `agent_type`: `custom`
- `creator`: `Seif Alsoub / S/`
- `capabilities`: integration orchestration, connector routing, identity binding, audit handoff
- `permissions`: least-privilege, platform-specific grants only
- `parent_passport_id`: owner/root passport when present
- `metadata.integration_role`: `primary_integrator`
- `metadata.integration_policy`: `passport_first_native_when_available`

## Non-negotiable rule

No platform is required to abandon a built-in integration merely to pass through S/Integrator. The Passport is the authoritative trust and governance layer; the connector implementation may remain native.
