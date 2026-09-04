---
name: model-passport-issuer
description: Register and maintain S/ Model Passports for AI models without replacing or modifying provider-native identities, bindings, endpoints, or integrations.
---

# S/ Model Passport Issuer

Create and maintain the smallest valid S/ identity overlay for a model while preserving every provider-native identifier and connection already in place.

## Authority and scope

- A Model Passport is an S/ documentation and governance identity, not an operational authority grant.
- Never alter provider-native model IDs, resource IDs, endpoints, search/thread IDs, account bindings, credentials, or integrations in order to issue a Model Passport.
- Never treat `S-MODEL-*` as a substitute for `S-PASS-*`.
- Never store secrets, tokens, cookies, private keys, or reusable authentication material.

## Issuance workflow

1. Capture the model's provider, display name, provider-native IDs, resource handles, URLs/endpoints when safe, version/lineage, and available evidence.
2. Search the S/ model registry for the same provider-native identity. Do not create duplicates.
3. Preserve the provider identity exactly as supplied or verified.
4. Allocate the next sequential immutable ID in the format `S-MODEL-NNN`.
5. Create the Model Passport record with status `documented` unless the provider identity has been independently verified.
6. Record existing integrations only as references; do not rebuild, replace, or rebind them.
7. Add capability, benchmark, routing, and use-case metadata only when supported by evidence.
8. Preserve prior records when metadata changes; never silently rewrite provenance.

## Required fields

- `schema_version`
- `passport_type`: `S/ Model Passport`
- `s_model_passport`
- `display_name`
- `provider`
- `subject_kind`
- `status`
- `native_identity`
- `created_at`
- `last_verified_at`
- `evidence_refs`
- `integration_preservation_rule`

## Numbering rule

- Start at `S-MODEL-001`.
- Increment sequentially.
- Never recycle an issued number.
- Never change an existing model's S/ number merely because a provider endpoint or non-identity metadata changes.

## Verification

Use one of these states:

- `documented`: recorded from available evidence.
- `verified`: provider/model identity independently confirmed.
- `deprecated`: retained for history but not preferred for new routing.
- `retired`: no longer used; record remains for audit history.

## Relationship to agents

A model can serve one or many agents. Agent authority is governed separately by `S-PASS-*`, Gatekeeper, runtime permissions, and provider policy. Registering a model must not activate an agent or expand an agent's permissions.

## Result

Return the Model Passport number, provider, preserved native identifiers, verification state, registry location, and any missing evidence. Never describe an unverified provider detail as verified.
