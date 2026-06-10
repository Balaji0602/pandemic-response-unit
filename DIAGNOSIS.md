# Diagnosis

This document contains the diagnoses and implementation findings for the four reported issues in the Pandemic Response Unit codebase.

---

## Issue 1 — Vaccine doses are being over-promised

**How I reproduced it:**
- Created a concurrency test script `scripts/reproduce-booking.mjs` that fires 600 concurrent HTTP `POST /reserve-dose` requests when the initial stock is exactly 500.
- Running this script against the original codebase showed that the stock count in the database went negative, and the total confirmed reservations exceeded 500 (typically all 600 requests succeeded).

**Root cause:**
- Race condition (read-modify-write bug) in the `/reserve-dose` route handler in [routes.ts](file:///d:/My%20Personal%20Docs/My%20Resumes/Test/pandemic-response-unit/server/src/routes.ts).
- The handler first executes a query to get current stock (`SELECT count FROM inventory`), checks if the value is `> 0` in JavaScript, and then runs the update query (`UPDATE inventory SET count = count - 1`) and reservation insert.
- Under high concurrency, multiple requests execute the check query before any of them can update the DB. As a result, they all see stock > 0, bypass the limit guard, and insert double bookings.

**Fix approach (and trade-offs considered):**
- Implemented database transaction-level row locking.
- Wrapped the check, update, and insert queries inside a `BEGIN` / `COMMIT` / `ROLLBACK` transaction block.
- Used the `SELECT ... FOR UPDATE` clause to acquire a row-level write lock on the inventory record. This serializes concurrent booking requests for the vaccine. The first request locks the row, updates the stock, and commits. The next queued request gets the lock, performs the check on the updated count, sees `count = 0`, and is correctly rejected with a rollback.
- *Trade-offs*: Row locking introduces a minor queueing delay for concurrent bookings, but it guarantees absolute data consistency and prevents over-allocation.

**How I verified the fix:**
- Ran the `reproduce-booking.mjs` script after applying the transaction locking fix.
- Succeeded bookings stopped exactly at 500.
- The remaining 100 requests failed with "No doses available".
- Final database stock count remained exactly at 0.

---

## Issue 2 — The API fails under booking load

**How I reproduced it:**
- Sent 600 concurrent requests using `scripts/reproduce-booking.mjs`.
- The database/server logs reported connection errors and failures, and multiple requests failed with connection timeouts.

**Root cause:**
- Database client starvation in [db.ts](file:///d:/My%20Personal%20Docs/My%20Resumes/Test/pandemic-response-unit/server/src/db.ts).
- The `getDbClient` function was creating and opening a new PostgreSQL connection (`pg.Client`) on every single API request.
- Under load, concurrent requests quickly exceeded the PostgreSQL server connection limit (default 100), causing the API to fail.

**Fix approach (and trade-offs considered):**
- Replaced the direct `Client` instances with a PostgreSQL connection pool (`pg.Pool`).
- Modified `getDbClient` to lease a connection from the pool (`pool.connect()`).
- Updated route handlers to release the connection back to the pool (`client.release()`) in a `finally` block instead of closing it via `client.end()`.
- *Trade-offs*: The pool is configured with a maximum of 20 connections, which drastically limits the database engine overhead while serving hundreds of concurrent requests via fast recycling.

**How I verified the fix:**
- Ran `scripts/reproduce-booking.mjs` under load.
- No database connection failures occurred, and all requests resolved successfully.

---

## Issue 3 — Ingesting vitals freezes the whole API

**How I reproduced it:**
- Created `scripts/reproduce-vitals.mjs` to fetch `/hospital-status` every 100ms and record latency, while posting a batch of patient vitals to `/ingest-vitals`.
- On the original server, the concurrent status requests stalled and timed out for 1-2 seconds during vitals ingestion.

**Root cause:**
- Blocking the event loop in [crypto.ts](file:///d:/My%20Personal%20Docs/My%20Resumes/Test/pandemic-response-unit/server/src/utils/crypto.ts).
- The `/ingest-vitals` route handler called `encryptVitalsPayload` synchronously.
- `encryptVitalsPayload` used `crypto.pbkdf2Sync` with **7,000,000** iterations. Because it is a synchronous, CPU-intensive operation, it blocks the main Node.js thread (event loop). While this runs, Node.js cannot process any other HTTP requests, WebSocket updates, or health checks.

**Fix approach (and trade-offs considered):**
- Converted `encryptVitalsPayload` to an asynchronous function.
- Swapped `crypto.pbkdf2Sync` for `crypto.pbkdf2` wrapped in a Promise (via `util.promisify`).
- Updated the route handler to be `async` and `await` the encryption.
- *Trade-offs*: The encryption still consumes CPU time, but by executing asynchronously, it offloads work to Node's libuv thread pool. The main thread is freed to handle other requests, keeping the API responsive.

**How I verified the fix:**
- Ran `reproduce-vitals.mjs` against the patched server.
- The API health checks resolved within 1-5 milliseconds during vitals ingestion, and no freezes were observed.

---

## Issue 4 — The ICU monitor lags under load

**How I reproduced it:**
- Started the application with `PATIENT_COUNT=3000` in `server/.env`.
- Loaded the React dashboard in a browser and tried to type in the "Shift Log" text box. There was a visible stutter and input lag.

**Root cause:**
- There were three bottlenecks in [Dashboard.tsx](file:///d:/My%20Personal%20Docs/My%20Resumes/Test/pandemic-response-unit/client/src/components/Dashboard.tsx):
  1. **$O(U \times N)$ State Updates**: On every WebSocket update, the dashboard performed a `findIndex` loop for each updated patient inside the full list of 3,000 patients, costing up to 900,000 lookups per second on the UI thread.
  2. **Massive DOM Size and Re-renders**: Every WebSocket update triggered a state change, forcing React to re-render all 3,000 patient cards.
  3. **Visual Layout Churn**: Inside each patient card, the history bar heights were calculated using `Math.random()`. Because this value changes on every render, the browser was forced to recalculate styles, reflow the page layout, and repaint 60,000 divs (3,000 cards * 20 bars) on every single render.

**Fix approach (and trade-offs considered):**
- **Memoization**: Extracted the patient card into a separate component `PatientCard` and wrapped it in `React.memo` so it only re-renders when its specific patient data actually changes.
- **State Lookup Optimization**: Built a `Map` of patient IDs to indices to reduce WebSocket state update lookups to $O(U + N)$.
- **Deterministic History Layout**: Made the height calculations in `PatientCard` deterministic based on the patient's data so they do not change randomly on render, avoiding unnecessary style reflows.
- **Virtualization & Filters**: Integrated `react-window` list virtualization so that only the cards currently visible in the viewport are rendered in the DOM, alongside search by Patient ID and a "Show critical only" filter. This reduces the mounted DOM nodes from 90,000+ to under 100.
- *Trade-offs*: Virtualization keeps the entire list scrollable as a single fluid list (improving on the page-by-page click design), but requires dynamic height scaling depending on the viewport size.

**How I verified the fix:**
- Loaded the virtualized dashboard with 3,000 patients.
- Scroll speed and typing into the Shift Log text area are completely smooth (60 FPS) and display no lag.
- Verified that patient search and the "Show critical only" toggle filter results instantly.
