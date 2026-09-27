# Governed Delegation Control Plane

S/Passport scales by issuing **bounded authority**, not generic access. An agent is free to act within its approved authority envelope; a gate intervenes when it crosses an authority boundary.

> No agent enters the system without an owner, a purpose, an expiry, and a revocation path.

## Canonical objects

| Object | Purpose | Must be authoritative |
| --- | --- | --- |
| Passport | Identity, issuer, status, root signing trail | Yes |
| Authority envelope | Capabilities, constraints, lifecycle, delegation depth | Yes |
| Gate request | One requested action and its context | Yes |
| Decision receipt | Hash-chained record of the gate decision | Yes |
| Quarantine status | Immediate removal of effective authority | Yes |

The authority envelope is defined in `authority-envelope.schema.json`. It is an additive, v1 control contract for the existing Passport payload; do not permit alternative formats at the gate.

## Enforcement model

```text
verified passport + current revocation state
  -> exact authority-envelope check
  -> green / yellow / red lane
  -> decision receipt
```

| Lane | Eligible actions | Gate result |
| --- | --- | --- |
| Green | Routine, reversible, in-scope | Allow automatically |
| Yellow | In-scope but unusual/write-sensitive | Require independent policy validation |
| Red | New authority class, external system, data domain, spend, delegation, or irreversible action | Require explicit owner approval |

A request missing an exact capability, matching purpose, valid expiry, allowed domain, or in-range delegation depth is denied. A child may only receive a strict subset of its parent's effective authority.

## Runtime integration

`server/governance.ts` provides a pure evaluator for use at every relying gate:

The additive Supabase schema in `supabase/migrations/20260927_passport_governance.sql` stores signed authority envelopes and append-only, per-passport receipt chains. It does not enroll the 85 existing passports automatically: an issuer must sign a new envelope for each eligible passport. The schema alone does not make the web demo a live gate.

1. Load and verify the Passport signature using the correct issuer.
2. Retrieve current live status; fail closed for revoked, quarantined, suspended, expired, or unavailable status.
3. Build the action request from trusted gate context—not client-supplied claims. Load approval/validation evidence separately from the gate's trusted store, bound to the passport and action with an expiry. Never copy an approval flag from the action payload.
4. Call `evaluateAuthority`.
5. Persist the returned receipt in an append-only store, chaining `previous_receipt_hash`.
6. Issue a one-time, audience-bound capability only when the decision is `allow`.

The evaluator is not itself a credential broker. S/GatePass remains responsible for secret isolation and must never return reusable credentials.

## Quarantine and revocation

- **Revocation** is permanent for the credential and takes effect at the next gate check.
- **Quarantine** is a temporary deny-all state entered automatically on anomaly signals or manually by the owner.
- A gate must treat a registry lookup failure as a denial for Yellow and Red actions; no cached approval may create broader authority.
- Renewals issue a new envelope and signature; they never silently extend a previous authority period.

## Cockpit contract

The browser governance cockpit should surface live effective state, not merely the original issued document:

- active, quarantined, revoked, and expired agents;
- owner, purpose, root policy, and expiry;
- effective capabilities and constraints;
- pending Yellow and Red escalations;
- delegation graph and depth;
- hash-linked action receipts and anomaly alerts;
- pause, revoke, and constrain controls.

Templates may prefill safe envelopes for researcher, coding, operator, trading, and coordinator agents. Templates set defaults; they never bypass the canonical gate checks.

## Security invariants

- Final authority resolves to Seif-controlled root policy.
- No agent, chain, or validator can manufacture broader privilege than it received.
- Agents receive short-lived capabilities, never long-lived secrets.
- Every allowed action is attributable; every decision receives a receipt.
- Human approval is required for new authority classes, not routine actions already inside the envelope.
