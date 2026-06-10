// Confirms the system is wired up and reachable.
// It does NOT test any of the reported issues — that is your job.
import { io } from 'socket.io-client';

const API = 'http://localhost:3000';
const fail = (msg) => { console.error(`\n[FAIL] ${msg}`); process.exit(1); };

console.log('Checking system setup...\n');

// 1. API + database reachable (/hospital-status reads from Postgres).
try {
  const res = await fetch(`${API}/hospital-status`);
  if (!res.ok) fail(`/hospital-status returned HTTP ${res.status}`);
  const { count } = await res.json();
  console.log(`[ok]  API and database reachable (inventory: ${count} doses)`);
} catch (err) {
  fail(`Could not reach the API at ${API} — is the server running? (${err.message})`);
}

// 2. WebSocket reachable.
await new Promise((resolve) => {
  const socket = io(API, { reconnection: false, timeout: 5000 });
  socket.on('connect', () => {
    console.log('[ok]  WebSocket reachable');
    socket.disconnect();
    resolve();
  });
  socket.on('connect_error', (err) => fail(`WebSocket connection failed: ${err.message}`));
});

console.log('\nSetup looks good — the system is wired up.');
console.log('Note: this check does NOT verify any of the reported issues.');
process.exit(0);
