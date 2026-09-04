# S/ Model Passport Policy

## Purpose

The **S/ Model Passport** is S/'s internal documentation and identity layer for external or internal AI models that work with the S/ ecosystem.

It is an **overlay identity only**. It never replaces, rewrites, aliases away, or mutates a provider's native model ID, resource ID, endpoint, thread/search ID, account binding, integration, or authentication relationship.

## Passport number

- Format: `S-MODEL-NNN`
- Example: `S-MODEL-001`
- Numbers are sequential, unique, and immutable once issued.
- The S/ number is an internal cross-reference, not a provider-side identifier.

## Core rule

> Preserve the model exactly where it already lives. Add the S/ Model Passport above its native identity for documentation, governance, routing, and evidence.

A model keeps all provider-native identifiers and bindings. S/ records those identifiers as evidence and crosswalk metadata.

## What a Model Passport does

A Model Passport may record:

- S/ Model Passport number
- display name / internal alias
- provider
- provider-native model or resource identifiers
- provider URLs or endpoints when safe to record
- model/version lineage
- documented capabilities
- benchmark and evaluation evidence
- approved S/ use cases
- verification status and dates
- references to integrations that already exist

## What a Model Passport does not do

A Model Passport does **not**:

- replace an `S-PASS-*` Agent Passport
- grant tool, runtime, financial, production, or identity-bearing authority
- mint or replace provider credentials
- copy or store secrets, tokens, cookies, private keys, or authentication material
- change the provider's native model/resource IDs
- break or rebind an existing integration
- imply that S/ owns the underlying provider model

Operational authority remains governed by the relevant Agent Passport, Gatekeeper policy, runtime permissions, and provider integration.

## Required record fields

Every Model Passport record must contain:

- `schema_version`
- `passport_type`
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

## Identity and duplicate handling

Before allocating a new number:

1. Search existing model records for the same provider-native model/resource identity.
2. If the same subject already exists, update its metadata rather than issue a duplicate number.
3. Preserve the same `S-MODEL-*` number for the same documented subject identity.
4. If the provider introduces a materially distinct model identity or version that S/ treats as a separate subject, issue a new Model Passport and record lineage to the prior model when relevant.

## Verification states

- `documented`: native identifiers are recorded from available evidence.
- `verified`: the provider/model identity and recorded native identifiers have been independently confirmed.
- `deprecated`: the model remains historically documented but should not be selected for new work.
- `retired`: the model is no longer used by S/, while its record remains immutable for audit history.

## Integration preservation

Existing integrations are authoritative for connectivity. The Model Passport only references them.

When a model already has a working provider connection, API route, application binding, or native resource identifier, **do not rebuild or replace that connection simply to support the S/ Model Passport**.

## Relationship to S/ Agent Passport

- `S-MODEL-*` = model documentation and stable S/ cross-reference.
- `S-PASS-*` = agent/worker operational identity and authority.

A model may be used by multiple agents. An agent may route across multiple models. Their identities remain separate.

## Ownership and provenance

The S/ Model Passport number and registry metadata are maintained by S/ as an internal governance layer. The underlying model, provider identifiers, and provider-side relationships remain attributable to their original provider and source.
