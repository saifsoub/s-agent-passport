# Passport Signature SDK

Use `passportSignatureMiddleware(resolver, requiredGrant)` on premium routes before any response body or stream is opened.

Signed request headers:

- `x-passport-id`: `sp_` + first 24 hex chars of SHA-256 over the DER SPKI public key.
- `x-passport-timestamp`: Unix epoch milliseconds; default replay window is 5 minutes.
- `x-passport-signature`: base64 SHA-256 signature over the canonical payload.

Canonical payload:

`METHOD\nPATH_WITHOUT_QUERY\nTIMESTAMP\nJSON_BODY`

Recommended gates:

- Premium context stream: `premium_context`
- University course generation: `course_generate`
- MCP connection/message transport: `mcp_connect`

A passport that exists but is revoked, has a mismatched derived ID, an invalid signature, stale timestamp, or missing grant is rejected before the protected handler runs.
