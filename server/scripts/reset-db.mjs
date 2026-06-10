// Resets the database to a clean state: 500 doses, no reservations.
// Run with: npm run db:reset
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, '..', 'db', 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(schema);
  await client.query('TRUNCATE reservations;');
  await client.query(
    `INSERT INTO inventory (item_name, count) VALUES ('Pfizer-Batch-A', 500)
     ON CONFLICT (item_name) DO UPDATE SET count = 500;`,
  );
  console.log('Database reset: inventory = 500 doses, reservations cleared.');
} catch (err) {
  console.error('Database reset failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
