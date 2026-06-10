# Verification scripts

Scratch space for scripts that reproduce the reported issues and prove your
fixes work. **Building these is part of the exercise** — nothing here tests the
fixes for you.

## Setup

```bash
npm install
```

This installs `pg` (PostgreSQL client) and `socket.io-client` — the libraries
you are most likely to need. Node 20+ provides `fetch` globally.

## Running

```bash
node check-setup.mjs          # confirms the system is wired up
node example-healthcheck.mjs  # minimal example: calling the API from a script
node <your-script>.mjs        # your own repro / verification scripts
```

## Connection details

- API:       http://localhost:3000
- WebSocket: http://localhost:3000
- Database:  postgres://admin:password@localhost:5432/hospital_db
