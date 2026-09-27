# Supabase control plane

The official S/Passport portal is **https://s-agentpass.online/**.

This directory is the deployment record for the S/Agency Supabase project. It extends the existing `public.agent_passports` registry (it does not create a second registry).

## Live components

| Component | Purpose |
| --- | --- |
| `passport_authority_controls` | Current authority envelope and effective quarantine/suspension state |
| `passport_authority_events` | Append-only lifecycle/control history |
| `passport_decision_receipts` | Existing hash-linked action decisions; now immutable |
| `passport-gate` Edge Function | Server-only gate evaluator and receipt writer |

## Gate contract

`POST /functions/v1/passport-gate` requires a **service-role JWT**. It is not callable by a browser or agent directly.

Required payload:

```json
{
  "passport_id": "S-PASS-...",
  "action_id": "opaque-action-id",
  "capability": "web_search",
  "purpose": "research",
  "delegation_depth": 0
}
```

The function reads the existing Passport registry and live authority control record, evaluates Green / Yellow / Red rules, writes an immutable receipt, and returns a structured decision.

- No envelope, a non-active passport, expiry, quarantine, or scope/purpose mismatch produces a denial.
- Yellow requires `secondary_validation: true`.
- Red always returns `require_owner_approval`; a trusted approval workflow must be added before it can become allow.
- Use only a server-held service-role key to call the gate. Do not expose it to the portal.

## Deployment

Apply the migration before deploying the function. The function is deployed with `verify_jwt: true` and additionally rejects non-service-role JWTs. It uses the Supabase runtime credentials only; no secret is stored in this repository.

The portal's application server should call the function at the point of execution, after it verifies the correct Passport issuer signature. A downloaded Passport document alone is never authorization.
