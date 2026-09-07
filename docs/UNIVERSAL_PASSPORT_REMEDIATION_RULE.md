# Universal Passport Remediation Rule

Status: CANONICAL OPERATING RULE
Owner: S/Agency
Scope: all agents, workers, fleets, University cohorts, control planes, runtimes, and future registries.

## Universal rule

A missing Passport is not a terminal blocker. It MUST automatically trigger remediation:

`No Passport → Create Passport Request → Pre-fill known identity/runtime data → Send to Passport Issuer → Validate → Issue passport_id → Write back to canonical registry → Enable worker eligibility`

## Required behavior

1. Detect a missing `passport_id` during registration, discovery, reconciliation, enrollment, deployment, or heartbeat processing.
2. Automatically create a Passport Request. Do not stop at a `BLOCKED` label.
3. Pre-fill every known field from canonical evidence, including where available:
   - worker/agent ID
   - name
   - role/type
   - repository and source path
   - execution/runtime type
   - runtime target/endpoint
   - scope/purpose
   - owner
   - capabilities
   - public key/runtime identity evidence
4. Send the request to the canonical Passport Issuer.
5. Validate identity, provenance, required runtime binding, and issuance requirements.
6. If validation succeeds, issue the canonical `passport_id` and required signature/binding evidence.
7. Write the issued Passport back to the canonical Passport Registry and the originating registry/roster.
8. Re-evaluate eligibility automatically. A worker/agent becomes eligible only after the required Passport evidence is valid.

## Missing prerequisite behavior

If issuance cannot continue, the system MUST expose an actionable remediation state rather than a generic blocker.

Example:

`passport_issuance_pending — missing runtime public key — owner: runtime binding worker — next: obtain and attach public key`

Every pause must identify:
- exact missing prerequisite;
- responsible owner/system;
- next executable action;
- evidence required to resume.

## Safety invariant

This rule automates remediation, not unauthorized activation.

`No valid Passport → no activation eligibility.`

The system should attempt to obtain a valid Passport automatically; it must never fabricate a Passport ID, signature, public key, provenance event, or runtime binding.

## Design principle

**Status must drive action, not replace action.**

`BLOCKED` is a temporary diagnostic state only when an actual prerequisite prevents the remediation workflow from continuing. It is never the default response to a missing Passport.
