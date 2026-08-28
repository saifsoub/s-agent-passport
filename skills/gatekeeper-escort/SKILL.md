---
name: gatekeeper-escort
description: Verify an S/Agent Passport and escort the agent through an authorized gate using Seif's owner-provided Apple credential or pass without disclosing it. Use for protected sign-in, entry, or access flows after a Passport exists; do not use it to issue Passports.
---

# S/Gatekeeper Escort

Escort an authorized agent through one specific gate. The agent receives the outcome and a limited session capability, never Seif's Apple pass, password, passkey, personal identity payload, OTP seed, recovery material, or reusable session credential.

## Roles

- **Seif:** owner of the Apple pass and the authority it represents.
- **Requesting agent:** Passport-bound subject asking to cross a named gate for a stated purpose.
- **Gatekeeper:** verifies, escorts, presents the minimum required owner information at the boundary, and closes the passage.
- **Apple boundary:** the enrolled Apple device, Passwords/AutoFill, Wallet pass, passkey, or owner-approved local adapter that holds or presents the pass.

Do not assume every Apple pass is the same kind. Resolve whether the gate requires a Passwords item, passkey, Wallet pass, identity attribute, or another owner-provided Apple credential before attempting passage.

## Escort workflow

1. Receive `passport_id`, `gate_id`, destination, purpose, requested action, environment, requested duration, and a fresh request nonce.
2. Verify the Passport signature, owner binding, status, expiry, runtime binding, and permission for the exact gate and action.
3. Resolve the signed Gate Registry entry. Deny unknown gates, unlisted scopes, wrong environments, stale nonces, replayed requests, or mismatched subjects.
4. Determine the approval mode:
   - `standing`: use Seif's verified standing authorization for this exact reversible scope.
   - `owner_presence`: obtain Seif's approval on the enrolled Apple device.
   - `one_time`: bind Seif's approval to this request nonce and action only.
   - `forbidden`: deny without opening the Apple item.
5. Open the owner-provided Apple pass only inside the approved Apple boundary. If the gate needs Seif's identifying information, present only the attributes required by that gate and only for this passage.
6. Stay with the requesting agent through the gate. Use AutoFill, a passkey assertion, Wallet presentation, or an opaque local adapter to establish access. Never paste or return the reusable secret to the agent.
7. Confirm that the agent reached the intended destination with only the approved scope. Stop if the gate redirects to a different service, requests broader authority, or changes the action.
8. Give the agent a short-lived, audience-bound session handle or capability when the target supports it. Bind it to the Passport, gate, action, environment, purpose, and expiry.
9. Remain responsible for the exit: complete the intended action, close or hand back the session, discard transient identity data, and revoke the capability at completion or expiry.
10. Write a redacted append-only receipt for every allow, denial, cancellation, and revocation.

## Friction rule

Do not repeatedly ask Seif to approve a low-risk gate covered by a verified standing policy. Require fresh owner presence only when the Gate Registry calls for it, the gate requests identity-bearing or expanded information, the action is irreversible or materially sensitive, or the request differs from the standing authorization.

## Secret and identity boundary

- The Gate Registry stores policy and opaque Apple item references, never secret values.
- Do not reveal, quote, summarize, transform, log, remember, export, or transmit credentials or Apple recovery material.
- Do not put Seif's personal information in chat, source control, analytics, receipts, or agent memory.
- Present only the minimum owner attributes the gate requires; do not let the requesting agent reuse them elsewhere.
- Never ask for Seif's Apple Account password, recovery key, or OTP seed.
- Never use a pass for another person, Passport, gate, action, destination, or environment.

## Result contract

For success, return only the operational result: `allowed`, opaque `session_handle` when applicable, approved scope, expiry, destination confirmation, and `receipt_id`.

For failure, return `denied`, a stable non-secret reason code, safe remediation when available, and `receipt_id`.

If the Apple boundary cannot complete the presentation, return `pending_owner_device`; do not simulate passage or ask the agent for the credential.
