---
name: passport-issuer
description: Issue, renew, amend, suspend, or revoke an S/Agent Passport end to end when a person, agent, or orchestrator requests one. Use for Passport onboarding and lifecycle work; a request starts processing but does not itself prove authorization.
---

# S/Passport Issuer

Create the smallest valid, traceable Passport that lets an agent operate across platforms without replacing integrations already built into those platforms.

## Authority model

- Accept a Passport request from any person, agent, orchestrator, university, or integration.
- Treat the requester as the initiator, not automatically as the approver.
- Issue only under Seif Alsoub's ownership or an issuer delegation that the Passport authority can verify.
- Never let an agent issue, approve, or expand its own Passport.
- Keep the agent inactive until the Passport is signed and every required binding is verified.

## Complete the issuance process

1. Capture the subject's stable identity, owner, lineage, role, runtime, public keys, tools, integrations, intended environments, data classes, and requested capabilities.
2. Search the Passport registry for the same subject, key, runtime identity, or upstream lineage. Renew or amend the existing Passport when appropriate; do not create a duplicate identity.
3. Verify the requester's authority, the subject's control of its key or runtime, and the evidence supporting each requested capability.
4. Classify requested capabilities by exact scope and environment. Prefer narrow scopes. Record risky, irreversible, financial, identity-bearing, or production actions as approval-bound unless Seif has granted a verified standing policy.
5. Create a pending Passport record when evidence or bindings are incomplete. Preserve useful intake work and list only the missing items; do not invent evidence.
6. When all issuance conditions pass, allocate a unique immutable `passport_id`, bind the subject's public identity, sign the Passport, set issue and expiry times, and activate it.
7. Register the signed Passport and its current status in the canonical Passport service. Update connected indexes such as Supabase, Notion, or GitHub only when those systems are part of the authorized workflow.
8. Emit an append-only issuance event and a human-readable receipt. Return the Passport, status, approved scopes, approval conditions, expiry, registry location, and evidence references.

## Required Passport fields

- `passport_id`
- `subject_id` and subject type
- owner: `Seif Alsoub`
- S/ family name and upstream lineage metadata
- runtime and public-key binding
- approved capabilities, scopes, environments, and integration bindings
- approval rules and Gatekeeper compatibility
- issue time, expiry, status, schema version, and issuer signature
- evidence references and append-only event reference

Never place passwords, passkeys, OTP seeds, recovery material, private keys, cookies, or reusable access tokens in a Passport.

## Integration rule

The Passport is the portable identity, authority, and evidence layer. Keep an existing platform integration built in. Add the Passport binding to that integration instead of replacing it. If no integration exists, the Passport can be presented to establish the new connection without locking the agent to one platform.

## Lifecycle behavior

- `renew`: retain the same subject identity and append a new signed version.
- `amend`: change only supported fields, record the basis, and revoke superseded grants when necessary.
- `suspend`: block new use immediately while preserving evidence and history.
- `revoke`: invalidate active capabilities and notify bound Gatekeepers or integrations.
- Never rewrite or delete prior issuance events. Current state is derived from the event history.

## Result states

Return exactly one operational state:

- `active`: issued, signed, registered, and usable.
- `pending_evidence`: intake retained; evidence is missing.
- `pending_owner_approval`: ready for Seif or a verified delegate.
- `pending_binding`: approval exists but a key, runtime, or registry binding is incomplete.
- `denied`: authority or policy forbids issuance; include a non-secret reason and receipt.
- `suspended` or `revoked`: lifecycle action completed and propagated.

Do not describe a pending record as an issued or active Passport.
