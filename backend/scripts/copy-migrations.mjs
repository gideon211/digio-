import { cp, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `tsc` only emits JavaScript, so SQL migrations never reach `dist` on their
 * own. Without them `node dist/db/migrate.js` has nothing to apply and a
 * deployment boots against a schema that is two migrations behind.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const from = resolve(root, 'src/db/migrations');
const to = resolve(root, 'dist/db/migrations');

// Start clean so a previous run cannot nest `migrations/migrations`. `cp`
// creates `to` as a copy of the source directory when it does not exist.
await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });

console.log(`Copied migrations to ${to}`);
