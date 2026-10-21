# D.CONNECT (Next.js 15 · App Router · TypeScript · Tailwind · Prisma/PostgreSQL)

## Phase 0: verify the project on your Windows laptop
This is the only thing to do right now. No new features are added until it passes.

### A. One-time installs (PowerShell, as normal user)
```powershell
winget install OpenJS.NodeJS.LTS        # must be Node 22 or newer; close and reopen PowerShell afterwards
winget install Docker.DockerDesktop     # then START Docker Desktop and wait until it says "running"
node -v                                 # expect v22.x or higher
docker --version
```

### B. Prepare the folder and settings
```powershell
Expand-Archive .\dconnect-nextjs-v5.zip -DestinationPath C:\dev
cd C:\dev\dconnect
Copy-Item .env.example .env

# Generate a SESSION_SECRET and copy the printed line into .env:
$b = New-Object byte[] 48; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($b); [Convert]::ToBase64String($b)

notepad .env     # set SESSION_SECRET=<that value>, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (10+ chars). Leave the API keys empty for now.
```
(Bash/Git Bash equivalent: `cp .env.example .env` and `openssl rand -base64 48`.)

### C. Run every check (stops at the first failure)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify.ps1
```
Bash/Git Bash: `./scripts/verify.sh`. It prints `ALL CHECKS PASSED` only if every step succeeded.

If the script itself misbehaves, run the steps by hand, in this order, and stop at the first error:
```powershell
npm install
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test:unit
docker compose up -d
docker compose exec -T db pg_isready -U dconnect     # repeat until it says "accepting connections"
npx prisma migrate dev --name init
npm run db:seed
npm run build
npm run start                                         # leave running; in a SECOND PowerShell window:
$env:INTEGRATION_BASE_URL="http://localhost:3000"; npm run test:integration
```
Note: the integration tests need `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in that second window too (`$env:SEED_ADMIN_EMAIL="..."; $env:SEED_ADMIN_PASSWORD="..."`).

### D. Send me
The full output of the **first failing step** (copy the red text and the lines above it). When everything passes, send the last 30 lines of the output.

### Data safety rules
- `prisma migrate dev` creates tables only. **If it ever says it must "reset the database", answer No (or press Ctrl+C) and send me the message.**
- Never run `docker compose down -v` (it deletes the database volume). `docker compose down` and `docker compose stop` are safe.
- The integration tests create test users (`@test.local`) and bookings. Run them only against the local Docker database, never against a database with real data.
- The seed script only creates the admin if that email does not exist yet.
- After the first successful migration, commit the generated `prisma/migrations` folder.

### Day-to-day development
`npm run dev` then open http://localhost:3000 and sign in with your seed admin.

Production: `npm run db:deploy && npm run build && npm start` (set `DATABASE_URL`, `SESSION_SECRET`; serve over HTTPS).

## Verification status (read this first)
> **v5 = v4 code plus Windows/PowerShell verification tooling and Node 22 requirement; no application logic changed.** A second attempt to run the full verification failed on the same network/Docker blocker (see `VERIFICATION.md` for the exact logs). Nothing beyond the 15 unit tests has been executed.

**The application as a whole has NOT been installed, built, linted or run.** The sandbox used to write it has no network access, no Docker and no PostgreSQL, so `npm install`, `prisma validate/generate/migrate`, `tsc` on the full project, `next lint` and `next build` could not be executed. No Google Maps, Anthropic or database integration has been exercised.

### What was actually run (sandbox, Node 22, global `tsx`/`tsc`)
| Command | Result |
|---|---|
| `tsx --test tests/unit/*.test.ts` | **15 tests, 15 pass, 0 fail** (fare calculation, booking transition rules, rate limiter) |
| `tsc -p <strict config>` on `lib/fare.ts`, `lib/transitions.ts`, `lib/ratelimit.ts` and all 4 test files (`strict`, `noUncheckedIndexedAccess`) | exit 0, no errors. This covers only those files, not the Next/Prisma code |
| TypeScript syntax parse of all 46 `.ts/.tsx` files | 0 syntax errors |
| Import resolver script (every relative/`@/` import exists; every npm import is in `package.json`) | 0 unresolved |
| `tsx --test tests/integration/*.int.test.ts` with no server | 12 tests **skipped**, 0 fail. **The integration tests have never actually run.** |

### Not run (needs your machine: network + Docker)
`npm install`, `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit` (whole project), `npm run lint`, `npm run build`, `prisma migrate`, `npm run db:seed`, integration tests, and every external-service test (Google Maps, geolocation on a device, Anthropic).

**One command runs all of them in order and stops at the first failure:** `cp .env.example .env` (fill `SESSION_SECRET`, `SEED_ADMIN_PASSWORD`), then `./scripts/verify.sh` (Windows: `scripts\verify.ps1`, see Phase 0 above). If something fails, send the output and it will be fixed.

### Changes in this revision
- `lib/transitions.ts` is now the single source of truth for who may move a booking between statuses; the PATCH route builds its atomic WHERE clause from it.
- Fixed a race: two simultaneous accepts by the *same* Captain could both pass the "one active duty" check. Accepts are now serialised per Captain with a Postgres advisory lock inside a transaction. (Written but untested against a real database.)

### Manual first-run checklist (after `./scripts/verify.sh` passes)
1. `npm install` then `npm run typecheck`, `npm run lint`, `npm run build`; fix whatever they report.
2. `npx prisma validate` and `npx prisma migrate dev --name init` against a real PostgreSQL; commit `prisma/migrations`.
3. Seed the admin, sign in, and walk the flow: Rider sign-up, book, Admin creates a Captain, Captain goes online and accepts, Rider sees the Captain, Captain completes.
4. Race test: two Captains accept the same booking at once; exactly one must succeed.
5. Role test: a Rider/Captain must get redirected from `/admin`, and receive 403 from admin APIs; a disabled user must be locked out on the next request.
6. With a real Google Maps browser key: maps render, geocoded pickup/destination pins appear, Captain markers move, bad/restricted key shows the error message.
7. With a server key: "Estimate" works and server-side distance overrides the client value.
8. On a real phone over HTTPS (geolocation requires a secure context except on localhost): permission prompt, denial message, background/foreground behaviour of GPS.
9. With an Anthropic key: Admin AI box answers using real counts.

## Known security trade-offs
- Sessions are stateless JWTs (7 days). Sign-out clears the cookie but cannot revoke a stolen token; disabling the user does.
- Login lockout is per email (8 tries/15 min), which lets someone deliberately lock out a known email for 15 minutes.
- The cross-origin check compares `Origin` to the `Host` header; behind a proxy that rewrites `Host`, adjust `middleware.ts`.
- `docker-compose.yml` uses a throwaway dev password (`dconnect`). It is for local use only; never expose that database or reuse the password.
- Rider location privacy relies on booking status; there is no audit log.

## Roles
| Role | Created by | Can do |
|---|---|---|
| Rider | public `/register` | book, cancel own *unaccepted* bookings, see assigned Captain live |
| Captain | Admin (`/admin` > Users) | go online (shares GPS), accept one duty at a time, complete it |
| Admin | seed script / another Admin | all bookings, cancel, users enable/disable, live map, AI summary |

## Credentials needed (external)
| Item | Variable | Without it |
|---|---|---|
| PostgreSQL | `DATABASE_URL` | app cannot run |
| Session secret (random 32+ chars) | `SESSION_SECRET` | app cannot run |
| Google Maps JS API key (browser, referrer-restricted) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | maps show a "disabled" notice; everything else works |
| Google Distance Matrix key (server, IP-restricted) | `GOOGLE_MAPS_SERVER_KEY` | "Estimate" button returns 501; riders type distance manually and the server trusts it (bounded 0.5-2000 km) |
| Map ID (optional) | `NEXT_PUBLIC_GOOGLE_MAP_ID` | `DEMO_MAP_ID` is used |
| Anthropic key | `ANTHROPIC_API_KEY` | `/api/ai` returns 501 |

## Security notes
HttpOnly + SameSite=Lax signed (HS256) session cookie; bcrypt (cost 12); zod validation on every route; roles re-checked against the DB on each request (disabled users lose access immediately); atomic duty acceptance; rider can only see their own Captain's location while a duty is ACCEPTED; login/sign-up/AI/location rate limits; cross-origin mutation block; security headers.

## Known limits
- Live tracking is HTTP polling (Captain posts every 5s, viewers poll every 5-10s), not WebSockets. Locations older than 60s are flagged "stale".
- Rate limiting is in-memory (single instance). Use Redis/Upstash behind multiple instances.
- Not built: chat, push notifications, masked calls, SOS, payments, password reset/email verification, a real pricing service (`lib/fare.ts` still uses demo rates), automated tests.
- No CSP header yet (Google Maps needs a tuned policy).

## Scope not yet built
Your extended product brief (delivery/parcel bookings, Razorpay payments and webhooks, notifications, ratings, support tickets, fare/service-area config, audit logs, admin analytics and exports, vehicle/captain verification, shadcn/ui, Socket.IO) is **not implemented**. Current scope is the Rider/Captain/Admin ride-booking core described above. It is better to get that core building and passing `./scripts/verify.sh` before adding those modules.

## Tests
`npm run test:unit` (no services needed) and `npm run test:integration` (needs the running app + database; see the header of `tests/integration/api.int.test.ts`).
