# S/GatePass

S/GatePass is the access broker for S/ agents. It lets an authorized, Passport-bound agent pass a protected gate without receiving or learning Seif's password, passkey, OTP seed, recovery key, or reusable session credential.

## Security boundary

There are two separate objects:

1. **S/GatePass Vault** — an Apple Passwords shared group containing the actual login items.
2. **Gate Registry** — the non-secret policy document described by `gate-registry.schema.json`.

The registry may contain an opaque credential reference such as `S-GatePass/example-workspace`. It must never contain the credential value. Do not commit exports from Apple Passwords, OTP seeds, recovery keys, cookies, or authorization headers.

Apple Account credentials and Apple recovery material are permanently outside S/GatePass.

## Request flow

1. A worker submits a signed request containing its `passport_id`, `gate_id`, scopes, purpose, environment, and a fresh nonce.
2. S/GatePass verifies that the Passport is active, belongs to Seif's S/ family, and is not suspended or revoked.
3. The policy engine checks the gate, exact scopes, environment, time window, TTL, and approval mode.
4. When required, Seif approves with user presence on an enrolled Apple device.
5. The local adapter uses the selected Apple Passwords item to establish the target session. Secret material is injected at the boundary and is never returned to the requesting agent.
6. S/GatePass returns a signed, one-time capability limited to that agent, gate, action, environment, and expiry.
7. An append-only redacted receipt is written. Revocation invalidates the pass immediately.

## Approval modes

| Mode | Behavior |
| --- | --- |
| `standing` | Pre-authorized, low-risk, reversible access within the exact registered scope. |
| `owner_presence` | Seif must approve on an enrolled Apple device. |
| `one_time` | One explicit approval for one request; no reuse. |
| `forbidden` | S/GatePass will never cross this gate. |

A missing gate, scope, environment, Passport, or approval always results in denial.

## Agent response contract

Allowed response:

```json
{
  "decision": "allow",
  "pass_id": "gp_...",
  "session_handle": "opaque_local_handle",
  "approved_scopes": ["read"],
  "expires_at": "ISO-8601",
  "receipt_id": "gpr_..."
}
```

Denied response:

```json
{
  "decision": "deny",
  "reason_code": "SCOPE_NOT_ALLOWED",
  "receipt_id": "gpr_..."
}
```

No response field may contain secret material.

## Activation checklist

- Create the Apple Passwords shared group named **S/GatePass Vault** on Seif's enrolled Apple device.
- Add only the credentials intended for agent-assisted access. Never add the Apple Account password or recovery material.
- Enroll the local user-presence adapter and bind it to Seif.
- Replace example Passport IDs and gate entries in a private deployment copy of the registry.
- Sign the registry and store only its digest/version in the Passport service.
- Enable append-only redacted receipts.
- Test deny cases first: unknown Passport, suspended Passport, wrong scope, expired nonce, wrong environment, and replay.
- Enable one low-risk standing gate, then owner-presence gates.
- Keep the public repository free of real gate names, account identifiers, and credential references.

## Non-negotiable invariants

- Secrets remain in the Apple-controlled credential boundary.
- Agents receive capabilities, never credentials.
- Every capability is least-privilege, short-lived, audience-bound, purpose-bound, and revocable.
- Every request produces a redacted receipt.
- Passport suspension or Gate Registry change revokes affected passes.
- S/GatePass cannot approve itself or expand its own policy.
