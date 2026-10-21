# Verification report: v4

**Result: the full verification could NOT be performed in the environment that produced this ZIP. v4 contains no code changes relative to v3, because no build, type, database or authorization error could be reproduced there.**

## Blocker (exact logs, 2026-10-21 sandbox)
```
$ npm install --no-audit --no-fund --loglevel=http
npm http fetch GET https://registry.npmjs.org/@prisma%2fclient attempt 1 failed with ENOTFOUND
npm http fetch GET https://registry.npmjs.org/@prisma%2fclient attempt 2 failed with ENOTFOUND

$ getent hosts registry.npmjs.org
registry.npmjs.org: no DNS resolution
$ curl -sS -m 8 -I https://registry.npmjs.org/
curl: (6) Could not resolve host: registry.npmjs.org

$ find / -name pg_ctl -o -name postgres -o -name docker -o -name initdb   # (excluding /proc)
(no results: PostgreSQL and Docker are not installed)
```
Consequence: `node_modules` could not be created, so every step that depends on it, and on a database, was impossible.

## Requested steps and their real status
| # | Step | Status |
|---|---|---|
| 1 | Inspect source + README | Done (static review only) |
| 2 | `scripts/verify.sh` | **Not run** (needs network + Docker). `bash -n` syntax check passes; that is all |
| 3 | `npm install`, `prisma validate` | **Not run** (ENOTFOUND) |
| 4 | `prisma generate`, migrations | **Not run** (no packages, no database) |
| 5 | Full `tsc --noEmit`, ESLint, production build | **Not run** |
| 5 | Unit tests | **Run: 15 tests, 15 pass, 0 fail** (`tsx --test tests/unit/*.test.ts`) |
| 6 | PostgreSQL + integration tests | **Not run** (no Docker/PostgreSQL). Suite skips itself: 12 skipped, 0 fail |
| 8 | Simultaneous-accept test | **Not run.** Test is written (`tests/integration/api.int.test.ts`); the advisory-lock transaction is untested against a real database |
| 9 | Privacy / disabled accounts / status permissions | Status-transition rules unit-tested (pure logic only). Privacy and disabled-account behaviour **untested** end to end |
| 10 | Google Maps, Anthropic | **Not tested** (no keys, no network) |
| 11 | Rerun tests after fixes | No fixes were possible; unit tests rerun: 15/15 pass |

Earlier static checks (still valid, not re-run in this pass): strict `tsc` on the pure modules and test files exit 0; all `.ts/.tsx` files parse; all imports resolve.

## What to run
```bash
cp .env.example .env        # set SESSION_SECRET (openssl rand -base64 48) and SEED_ADMIN_PASSWORD (10+ chars)
./scripts/verify.sh
```
It stops at the first failing step. Send that step's output to get it fixed. Do not treat this project as working until it prints `ALL CHECKS PASSED`.
