# Pandemic Response Unit — Engineering On-Call Round

## The scenario

St. Mungo's Hospital runs a "Pandemic Response Unit" (PRU) system: a live ICU
vitals monitor and a vaccine-dose reservation service. It was built quickly
during the first outbreak and is now misbehaving under a new wave of cases.

You are the engineer on call. Four issues have been reported (see below). Your
job is to investigate, diagnose, and fix as many as you can.

## How this round works

This is a ~2-hour round in two phases:

**Phase 1 — Diagnose (no AI assistance).**
Read the code, run the system, reproduce the reported issues, and write up your
findings in `DIAGNOSIS.md`. We want your unaided reasoning: what is happening,
why, and how you would fix it.

**Phase 2 — Implement (AI assistance allowed).**
Implement your fixes. You may use any AI coding assistant you like.

**You are not expected to fix all four issues.** We are assessing how you
diagnose, how you reason about trade-offs, and how you prove a fix works — not
how many you complete. One well-understood, well-verified fix beats four rushed
ones.

For every issue you work on, you should be able to **reproduce it** and
**demonstrate that your fix resolves it**. How you do that is up to you — see
[Verifying your work](#verifying-your-work).

## System architecture

- **Frontend** — React + Vite + TailwindCSS — port 5173
- **Backend** — Node.js + Express + Socket.IO — port 3000
- **Database** — PostgreSQL 15 — port 5432

## Prerequisites

- Node.js 20+ and npm
- Docker — used only to run PostgreSQL. If you prefer, use your own local
  PostgreSQL instead and point `DATABASE_URL` at it.

## Setup

```bash
# 1. Start PostgreSQL
docker compose up -d
docker compose ps          # wait until postgres reports "healthy"

# 2. Backend
cd server
cp .env.example .env
npm install
npm run dev                # serves on http://localhost:3000

# 3. Frontend (second terminal)
cd client
cp .env.example .env
npm install
npm run dev                # serves on http://localhost:5173
```

## Confirm the setup

With all three running:

```bash
cd scripts
npm install
node check-setup.mjs
```

This confirms the API, database, and WebSocket are reachable. **It does not
test any of the reported issues** — that is your job.

## Resetting the database

Some investigations change the data (e.g. reservation counts). To return the
database to a clean state — 500 doses, no reservations:

```bash
cd server
npm run db:reset
```

## Inspecting the database

```bash
psql postgres://admin:password@localhost:5432/hospital_db
# e.g.  SELECT * FROM inventory;
#       SELECT count(*) FROM reservations;
```

## The reported issues

> These are the reports as they came in from hospital staff. They describe
> symptoms, not causes.

### Issue 1 — Vaccine doses are being over-promised

We hold exactly **500 doses** of `Pfizer-Batch-A`. After a busy morning of
bookings, the system had recorded **more than 500 confirmed reservations** —
nobody changed the stock figure. Patients are arriving for appointments only to
be turned away.

Relevant: `POST /reserve-dose`, `GET /hospital-status`.

### Issue 2 — The API fails under booking load

When reservation requests arrive in a rush (a morning booking window), the API
starts returning errors and the PostgreSQL logs fill with connection-related
complaints. Handled one at a time, the same requests are fine.

Relevant: `POST /reserve-dose`, `server/src/db.ts`.

### Issue 3 — Ingesting vitals freezes the whole API

Whenever a batch of patient vitals is sent to `POST /ingest-vitals`, the
**entire API stops responding for one to two seconds** — the ICU monitor
stalls, other requests time out, and health checks fail during that window.

Relevant: `POST /ingest-vitals`.

### Issue 4 — The ICU monitor lags under load

At full ICU capacity the "ICU Live Monitor" becomes sluggish and typing into
the "Shift Log" stutters badly. With only a handful of patients it is smooth.

The patient count is set by `PATIENT_COUNT` in `server/.env` (default 3000).
Lower it and restart the backend to compare light vs heavy load. The "Shift
Log" text box is a deliberate responsiveness check — if typing lags there, the
UI thread is blocked.

Relevant: `client/src/components/Dashboard.tsx`, `client/src/components/ShiftLog.tsx`.

## Verifying your work

There is **no built-in test that checks your fixes** — building a way to
reproduce an issue and prove it is resolved is part of the exercise.

The `scripts/` directory is a ready-to-use scratch space for this:

- `pg` and `socket.io-client` are already installed there.
- `example-healthcheck.mjs` shows the basic pattern for calling the system from
  a script.
- Add your own scripts and run them with `node scripts/<your-script>.mjs`.

You are free to verify however you like — scripts, `curl`, `psql`, the browser.
What matters is that you can **show** an issue happening and **show** it fixed.

## Writing up your findings

Record your diagnosis in `DIAGNOSIS.md` (a template is provided). This is the
primary artifact we review — keep it updated as you work.

## Guidelines

- **Think out loud** — we want to hear how you diagnose.
- Phase 1: no AI assistance. Phase 2: any AI assistant is fine.
- Favour clear, maintainable code over clever code.
