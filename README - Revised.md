# Agent Passport — plain-language README

## What this is
An ID-card system for AI helpers ("agents"). Each card, called a passport, records who created the helper, what it is allowed to do, when that permission ends and whether it has been cancelled.

## Who it's for
- People who run AI helpers and want each one to have a clear, checkable permission slip.
- Administrators who approve or cancel those permissions.

## What it does today
- **Home page** (`/`): explains the product.
- **Owner page** (`/portal`): request a passport for a helper, see the ones you own and download them.
- **Admin page** (`/admin`): an administrator approves or cancels requests.
- **Demo** (`/demo`): an interactive walk-through. Nothing in the demo grants real access.
- When a request is approved, the passport gets:
  - an ID
  - the list of allowed actions
  - an expiry date
  - a tamper check: a digital signature made with a secret key on the server
- The `governance/` folder holds draft rules for sorting actions into three groups:
  - **Green:** routine actions that go ahead automatically.
  - **Yellow:** actions that need a second check.
  - **Red:** actions that need the owner's explicit OK.
- The `agents/s-gatepass/` folder holds a draft design for a "door-keeper" service. Before letting a helper act, it would check that the passport is valid.

Having a passport file is not enough on its own. Whatever system the helper is trying to use still has to check the passport is valid, unexpired and allows the action.

## How to run it
You need Node.js, pnpm (a package installer) and a MySQL database.

```bash
pnpm install   # install dependencies
pnpm check     # check the code for type mistakes
pnpm test      # run automated tests
pnpm dev       # start locally
```
For production use `pnpm build` and then `pnpm start`.

Settings such as the database address and the signing secret are read from environment variables. The names are in `server/_core/env.ts` and `drizzle.config.ts`. Never commit their values. Run `pnpm db:push` only against a database you really mean to change.

## Current status and known gaps
- The web app, demo and tests exist.
- An open pull request (#17) removes a publicly known backup signing key. Until it is merged and a real secret is set, do not use this for anything live.
- The Green/Yellow/Red rules and the door-keeper service are designs. No live version is confirmed.
- Two other pieces are described in project notes but are separate from this web app:
  - a Python version of the passport
  - a passport list stored in Supabase
- Dependency security alerts are open, including one for the test tool vitest.

## Where things live
| Folder | What's in it |
|---|---|
| `client/` | The website screens (if present; not yet confirmed) |
| `server/` | The back end; passport logic is in `server/passport.ts`, `server/passportDb.ts`, `server/routers.ts` |
| `governance/` | Draft permission rules |
| `agents/s-gatepass/` | Draft door-keeper design |

License: see `LICENSE`. You may evaluate and change it internally. Public copies, redistribution and commercial use need written permission.
