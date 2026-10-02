# Agent Passport

**Sovereign. Calibrated. Accountable.**

Agent Passport gives an agent a scoped identity: who issued it, what it can do, when it expires, and whether it remains active. This repository contains the Passport web product, a demonstration, and the GatePass policy specification.

The passport scales through **verifiable delegation**: every agent, capability, chain, and action must inherit a bounded, attributable, revocable authority trail from root policy. Routine actions proceed automatically inside the approved envelope; new classes of authority are escalated at the gate.

## What is here

- **Landing** (`/`): product overview.
- **Owner portal** (`/portal`): request passports, manage the owner's vault, and export issued passports.
- **Approval desk** (`/admin`): administrator review and revocation.
- **Interactive demo** (`/demo`): illustrates issuance and gate decisions; demo behavior is not a live authorization decision.
- **GatePass** (`agents/s-gatepass/`): policy and schema for an access broker. See its [README](agents/s-gatepass/README.md) for the boundary and activation requirements.
- **Governed delegation** (`governance/`): the canonical authority envelope, execution-lane policy, runtime evaluator, and decision-receipt contract. Start at [governance/README.md](governance/README.md).

The web app uses React, Vite, tRPC, Express, Drizzle, and MySQL. Its web issuance and vault implementation lives in `server/passport.ts`, `server/passportDb.ts`, and `server/routers.ts`. The Python Passport package and the Supabase `public.agent_passports` registry described in project notes are separate components; this web app's Drizzle tables are not automatically the same registry.

## Local development

Requirements: Node.js 22, the pnpm version pinned in `package.json` (10.4.1, available through Corepack), a MySQL database, and the application authentication configuration.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm dev
```

Provide the required environment variables through your local deployment configuration. Review `server/_core/env.ts` and `drizzle.config.ts` for the current names before starting; keep keys, database credentials, and vault contents out of commits. Run `pnpm db:push` only against a database you intend to migrate.

The full test suite includes a database integration test. Use a disposable MySQL database with the checked-in migrations applied (`pnpm exec drizzle-kit migrate`), not a production database. Passport CI provisions its own isolated MySQL 8 database and runs the frozen install, migrations, typecheck, full test suite, and production build on pull requests and main.

## Passport flow

1. The owner submits an agent name, type, purpose, requested tools, and optional expiry.
2. An administrator reviews the request. Approval issues a passport with an ID, capabilities, permission flags, provenance, checksum, and issuer signature.
3. The owner can view and export issued records. An administrator can revoke them.
4. A relying gate must check current registry status, expiry, signature, and required capabilities and permissions at the point of use. A downloadable passport alone does not grant access.
5. The gate evaluates the current authority envelope: Green actions proceed, Yellow actions need independent validation, and Red actions require explicit owner approval. Every decision emits a hash-linked receipt.

The web issuer uses an HMAC signature derived from its server secret; the separate Python package described in project notes supports Ed25519. Verify against the correct issuer and do not treat these signature schemes as interchangeable.

## Security and operating boundaries

Never commit secrets, credential exports, bearer tokens, recovery material, or real gate registry data. The example GatePass registry is illustrative. Public repository code does not imply that any gate, Supabase integration, server service, or deployment is active.

## License

[License Version 1.0](LICENSE). Internal evaluation and modification are permitted under its conditions; public forks, redistribution, hosted distribution, and commercial use require prior written permission.

Owned and maintained by the project maintainers.

### Passport and vault cryptographic configuration

Set `JWT_SECRET` to a private deployment secret before issuing passports or using the vault. Missing, empty, or whitespace-only configuration blocks minting, encryption, and decryption; signature verification returns false. There is no default cryptographic key. Keep the configured secret stable: changing it invalidates existing signatures and prevents decryption of existing vault records.

Existing records created with the former development fallback require controlled recovery before enabling this change: inventory affected records, recover vault values in an authorized isolated environment, and re-encrypt/reissue with the configured deployment key. Do not automatically rotate keys or copy recovered secrets into logs or repository files. The Vitest configuration uses an explicit test-only key.
