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

## Connector construction: S/Talabat

S/Talabat is a governed customer-side commerce connector registered under S/Integrator for Talabat shopping requests.

- `connector_name`: `S/Talabat`
- `platform`: `Talabat UAE`
- `integration_mode`: `browser_backed_customer_connector`
- `native_connector_policy`: reuse any future supported customer-side native Talabat integration when available; otherwise retain browser-backed execution.
- `passport_binding`: `S/Integrator Passport`
- `capabilities`: grocery/product search, nearest suitable store selection, cart construction, substitution handling, delivery ETA/fee retrieval, checkout handoff, order confirmation capture.
- `permissions`: authenticated Talabat session only; current saved delivery address; existing payment preferences; least-privilege shopping actions.
- `irreversible_action_policy`: require one compact owner approval immediately before the final purchase/payment action unless an explicitly pre-authorized spend policy exists.
- `audit`: record store, selected SKUs, substitutions, ETA, fees, total, approval reference, Talabat order number, and final status.
- `single_prompt_execution`: enabled. A shopping request should be sufficient to invoke the connector without rebuilding the integration.

### Current execution request

Create one Talabat basket containing:

1. Small bottled water — smallest practical single bottle or small pack.
2. Gif/Cif household cleaner — treat `gif` as the household cleaning product intent, not an unrelated item.
3. Dettol — standard/common household Dettol disinfectant or antiseptic product.

Selection policy: prefer one nearby store with all three items, optimize for fastest delivery first and reasonable total price second, avoid promotional extras, and use the closest same-brand equivalent if an exact item is unavailable. Present a single compact approval only at the irreversible checkout boundary, then capture order number and ETA after placement.

## Non-negotiable rule

No platform is required to abandon a built-in integration merely to pass through S/Integrator. The Passport is the authoritative trust and governance layer; the connector implementation may remain native.
