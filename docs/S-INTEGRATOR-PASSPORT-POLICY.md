# Integrator Passport Policy

## Decision

Passport is the first trust layer for integrations.

- If a platform already has a built-in integration, keep it.
- Attach Passport as the identity, ownership, scope, and audit layer.
- If no integration exists, Passport must be presented before access is established.
- Passport does not replace native integrations; it governs them.
- A valid Passport settles identity first; connector mechanics come second.

## Integrator

Integrator is the single integration control layer for Seif-owned platforms and accounts.

It receives its own Passport and acts as the governed integration identity across connectors.

### Operating model

1. **Passport first** — verify the Integrator Passport.
2. **Native integration second** — reuse an existing built-in connector when available.
3. **Passport metadata overlay** — bind owner, platform, scopes, permissions, expiry, and audit references to that integration.
4. **Fallback path** — when no native integration exists, require Passport presentation before creating a connector path.
5. **No forced rewiring** — an existing working integration remains intact unless an explicit migration is approved.

## Trust hierarchy

`Owner -> Integrator Passport -> Integration/Connector -> Platform`

Native platform credentials and OAuth grants remain platform-native. Passport records the governed identity and allowed scope around them.

## Required Passport metadata for Integrator

- `agent_name`: `Integrator`
- `agent_type`: `custom`
- `creator`: `<owner>`
- `capabilities`: integration orchestration, connector routing, identity binding, audit handoff
- `permissions`: least-privilege, platform-specific grants only
- `parent_passport_id`: owner/root passport when present
- `metadata.integration_role`: `primary_integrator`
- `metadata.integration_policy`: `passport_first_native_when_available`

## Connector construction: Talabat

Talabat is a governed customer-side commerce connector registered under Integrator for Talabat shopping requests.

- `connector_name`: `Talabat`
- `platform`: `Talabat UAE`
- `integration_mode`: `browser_backed_customer_connector`
- `native_connector_policy`: reuse any future supported customer-side native Talabat integration when available; otherwise retain browser-backed execution.
- `passport_binding`: `Integrator Passport`
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

## Connector construction: Binance

Binance is a Passport-governed, real-time Spot connector registered under Integrator.

- `connector_name`: `Binance`
- `platform`: `Binance Spot`
- `integration_mode`: `websocket_event_relay`
- `passport_binding`: `Integrator Passport`
- `native_connector_policy`: use Binance's native WebSocket API and User Data Stream; Passport adds the identity, scope, audit, and outbound webhook contract.
- `upstream`: `wss://ws-api.binance.com:443/ws-api/v3` (test mode: `wss://ws-api.testnet.binance.vision/ws-api/v3`).
- `capabilities`: public market-data subscriptions; read-only account balance updates; deposit/withdrawal balance updates; order execution updates; externally locked-balance updates.
- `permissions`: public market data needs no key; private events require a dedicated Binance key with `USER_DATA`/`USER_STREAM` only. `TRADE` is deliberately excluded.
- `secrets`: `BINANCE_API_KEY` and `BINANCE_WEBHOOK_SECRET` are vault references only. A webhook destination URL is deployment configuration, never Passport metadata.
- `webhook_contract`: `connectors/s-binance/webhook-relay.contract.json`.
- `irreversible_action_policy`: this connector cannot place, amend, or cancel orders. Any future trading connector must be separately Passport-scoped and require an explicit owner approval at the order boundary.
- `audit`: record event type, Binance event time, subscription id, masked symbol/asset references where appropriate, relay delivery id, response status, and retry outcome. Never write API keys, account balances, or full event payloads to a public audit log.

### Real-time relay behavior

Binance Spot does not publish arbitrary outbound webhooks. The Binance relay is therefore the bridge: it holds the WebSocket connection, normalizes permitted User Data Stream events, signs them, and POSTs them to the configured webhook destination.

1. Authenticate the WebSocket session and subscribe to the User Data Stream with the least-privilege key.
2. Allow only `outboundAccountPosition`, `balanceUpdate`, `executionReport`, `externalLockUpdate`, `eventStreamTerminated`, and `serverShutdown` events into the private relay.
3. Send the normalized envelope to the configured HTTPS destination with an HMAC-SHA256 signature over the exact UTF-8 request body.
4. Deduplicate by `delivery_id`; retry only failed deliveries with bounded exponential backoff. A receiver must treat a repeated `delivery_id` as idempotent.
5. Reconnect after `serverShutdown`, an expired stream, or any disconnect. Binance WebSocket sessions are limited to 24 hours and require pong handling.

The relay is disabled until its destination and both vault secrets are present. It starts in `read_only` mode and sends no order instructions upstream.

## Non-negotiable rule

No platform is required to abandon a built-in integration merely to pass through Integrator. The Passport is the authoritative trust and governance layer; the connector implementation may remain native.
