# ReliServe

**Reliability-first local services marketplace**  
Built for urgency, accountability, and real-world trust.

---

## Overview

ReliServe rethinks local service marketplaces by prioritizing:

- Reliability over inflated star ratings
- Emergency-first job handling
- Mutual accountability between customers and workers
- Behavior-based trust scoring

Unlike traditional platforms, ReliServe introduces:

- Behavior-based reliability scoring
- Lock-on-accept emergency handling
- AI-assisted job clarity to reduce disputes
- Structured job lifecycle enforcement

This project is being developed as a **production-style collaborative system** by a 4-developer engineering team.

---

## Core Goals

- Reduce cancellations and no-shows
- Improve emergency response times
- Reward consistent behavior
- Prevent disputes through structured job scope
- Simulate real-world marketplace constraints

---

## V1 Backend Features (Completed)

### Authentication
- POST `/v1/auth/signup`
- POST `/v1/auth/login`
- GET `/v1/auth/me`
- JWT authentication
- bcryptjs password hashing

### Jobs API
- POST `/v1/jobs`
- GET `/v1/jobs/:id`
- GET `/v1/jobs?mine=true`
- POST `/v1/jobs/:id/accept`
- POST `/v1/jobs/:id/start`
- POST `/v1/jobs/:id/complete`
- POST `/v1/jobs/:id/cancel`
- GET `/v1/jobs/:id/events`
- Default job status = `OPEN`
- Atomic lock-on-accept (`OPEN` -> `LOCKED`) with 409 conflict if already taken
- Lifecycle transitions:
- `LOCKED` -> `IN_PROGRESS` via `start`
- `IN_PROGRESS` -> `COMPLETED` via `complete`
- `OPEN` -> `CANCELED` via `cancel` (creator only, V1 rule)
- Protected routes via JWT middleware

### Emergency + Worker API
- POST `/v1/emergency`
- GET `/v1/worker/requests`
- Emergency jobs are created with `urgency=EMERGENCY` and `status=OPEN`
- Worker requests feed returns open emergency jobs (latest first)

### Database
- PostgreSQL (Docker)
- Prisma ORM
- Tables:
- `User`
- `WorkerProfile`
- `Job`
- `JobEvent`
- `Review`
- Migrations + seed script

### Validation
- Zod schema validation
- Proper HTTP status handling
- Duplicate email protection

---

## Tech Stack

### Frontend
- React (TypeScript)
- Vite
- Tailwind CSS
- React Router

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

### Infrastructure
- Docker
- Docker Compose
- Redis (reserved for realtime V2)

---

## Repository Structure

```txt
reliserv/
  apps/
    web/        # React frontend
    api/        # Node + Express backend
  infra/        # Docker (Postgres, Redis)
  docs/         # Architecture notes
```

---

# Run Locally (Clear Startup Guide)

## Prerequisites

Install these first:

- Node.js 20+ and npm
- Docker Desktop (running)

## First-Time Setup + Start

Run commands from the repo root: `reliserv/`.

1. Start infrastructure (Postgres + Redis).

```powershell
docker compose -f infra/docker-compose.yml up -d
```

2. Start backend (API) in terminal 1.

```powershell
cd apps/api
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Required values in `apps/api/.env`:

```txt
DATABASE_URL="postgresql://reliserv:reliserv@localhost:5432/reliserv?schema=public"
JWT_SECRET="dev_super_secret_change_me"
```

API URLs:

- `http://localhost:4000`
- Health check: `http://localhost:4000/health`

3. Start frontend in terminal 2.

```powershell
cd apps/web
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev
```

Frontend URL:

- `http://localhost:5173`

## Daily Start (After Initial Setup)

1. Start infra:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

2. Start API (terminal 1):

```powershell
cd apps/api
npm run dev
```

3. Start web (terminal 2):

```powershell
cd apps/web
npm run dev
```

## Verify Everything Is Running

Run from another terminal:

```powershell
curl http://localhost:4000/health
```

Expected: a successful JSON health response from the API.

Then open:

- `http://localhost:5173`

## Stop the Project

1. Stop API/web dev servers with `Ctrl + C` in each terminal.
2. Stop Docker services:

```powershell
docker compose -f infra/docker-compose.yml down
```

---

## Important Notes

- `.env` files are ignored by Git.
- Do not commit secrets.
- Prisma 7 uses `@prisma/adapter-pg` with `pg`.
- Test environment uses `apps/api/.env.test` and `reliserv_test` database.

---

## Windows + Docker Desktop Troubleshooting

If Docker Desktop fails:

Check WSL:

```powershell
wsl --status
```

If missing:

```powershell
wsl --install
```

Then reboot.

Ensure:

- CPU virtualization enabled in BIOS
- Hyper-V enabled
- Docker Desktop using WSL2 backend

---

## V1 In Progress

- Reliability score update system

---

## DEV2 Integration Tests (Jest + Supertest)

Integration suite file:

- `apps/api/src/__tests__/dev2.e2e.test.ts`

What it covers:

- Health + auth protection
- Emergency create + worker request feed
- Atomic accept (`200` then `409`)
- Lifecycle transitions (`start`, `complete`, `cancel` rule)
- Events endpoint includes `CREATED`, `ACCEPTED`, `STARTED`, `COMPLETED`

Run tests:

```powershell
docker compose -f infra/docker-compose.yml up -d
cd apps/api
npm test
```

What `npm test` now does:

- loads `apps/api/.env.test`
- waits for the Postgres test database to be reachable
- runs `prisma migrate deploy`
- executes Jest in-band

If Postgres is not running on `localhost:5432`, Jest fails early with a clear startup message instead of a generic Prisma schema engine error.

---

## Atomic + Lifecycle Proof

Validated on local API (`http://localhost:4000`) with 3 users:

1. Customer created emergency job via POST `/v1/emergency` -> `201`
2. Worker A accepted via POST `/v1/jobs/:id/accept` -> `200`
3. Worker B accepted same job via POST `/v1/jobs/:id/accept` -> `409`
4. Worker A started job via POST `/v1/jobs/:id/start` -> `200`
5. Worker A completed job via POST `/v1/jobs/:id/complete` -> `200`
6. GET `/v1/jobs/:id/events` includes `CREATED`, `ACCEPTED`, `STARTED`, `COMPLETED`

Conflict response from step 3:

```json
{ "error": "Job already taken" }
```

---

## DEV3 — Worker Presence + Emergency Matching + Trust Insights

This sprint adds realtime worker availability, geolocation matching, and trust insights.

### Worker Presence (Redis heartbeat)

Workers now send a heartbeat to keep their availability active.

Endpoint:

POST `/v2/worker/heartbeat`

Stores presence in Redis with TTL.

Presence payload:

{
userId,
lat,
lng,
at
}


Presence expires automatically if worker stops sending heartbeat.

Used for:

- Emergency worker eligibility
- Distance calculation
- Live availability filtering


### Emergency Matching Improvements

Emergency requests now use real geolocation.

Customer location:
- Browser geolocation
- Stored on Job (lat, lng)

Worker eligibility requires:

- serviceStatus = ONLINE
- emergencyOptIn = true
- active heartbeat
- matching category
- valid worker profile

Matching now considers:

- Distance
- Reliability score
- Emergency readiness


### Worker Dashboard Auto Heartbeat

Worker dashboard automatically sends heartbeat every 30 seconds.

This keeps worker eligible without manual refresh.

Implemented in:

WorkerDashboard.tsx


Heartbeat call:

POST `/v2/worker/heartbeat`


### Trust Insights View

Customer can view worker reliability details.

Includes:

- reliability score
- completion rate
- cancel rate
- emergency completions
- review stats
- job totals

Route:

/worker/:id/trust


Used in emergency recommendation panel.


### Emergency Worker Recommendation

Emergency page now shows prioritized workers.

Ranking uses:

- reliability score
- distance
- presence heartbeat
- emergency opt-in

Example:

Recommended emergency workers
Match score
ETA
Reliability
Reason for recommendation


This simulates real-world dispatch behavior.


### Redis Usage (V2)

Redis is now used for:

- worker presence
- TTL expiration
- realtime eligibility checks

Infrastructure:

Docker → Redis container


### Status

DEV3 features completed:

- Worker presence
- Heartbeat TTL
- Emergency geolocation
- Eligibility filtering
- Trust insights page
- Auto heartbeat
- Redis integration

---

## DEV3 Verification Notes

Verified on March 26, 2026 against the local Postgres + Redis-backed app flow.

### Verified Endpoints

- GET `/v2/map/workers?lat=27.8006&lng=-97.3964&mode=normal`
- GET `/v2/map/workers?lat=27.8006&lng=-97.3964&mode=emergency`
- GET `/v2/map/jobs/:id/map-candidates`

### Worker Visibility Rules

- `ONLINE` workers with a live heartbeat appear in normal mode.
- `OFFLINE` workers do not appear in normal or emergency mode.
- `BUSY` workers with active assigned jobs do not appear in map results.
- Emergency mode excludes workers with `emergencyOptIn = false`.
- Normal mode can still include standard-eligible workers who opted out of emergency work.
- Workers missing `lastKnownLat` or `lastKnownLng` are skipped safely and the endpoint still returns `200`.

### Job-Centered Candidate Rules

- Job map candidates are calculated from the job's stored `lat` and `lng`.
- Emergency jobs return emergency-eligible workers only.
- Normal jobs return standard-eligible workers only.

### ETA and Distance Checks

- closer workers return smaller `distanceMiles`
- closer workers return smaller `etaMinutes`
- farther workers sort below closer workers
- values are not negative
- missing coordinates do not fabricate ETA or distance values

### Frontend MapView States

`MapView` is verified for:

- loading while browser geolocation or worker fetch is in progress
- empty when no eligible workers are returned
- error when map loading fails

The initial geolocation lookup now sets loading immediately so the page does not render in an ambiguous pre-fetch state.

### Verification Files

- [apps/api/src/__tests__/map.e2e.test.ts](/c:/Users/shank/OneDrive/Desktop/reliserv/apps/api/src/__tests__/map.e2e.test.ts)
- [apps/web/src/pages/MapView.test.tsx](/c:/Users/shank/OneDrive/Desktop/reliserv/apps/web/src/pages/MapView.test.tsx)
