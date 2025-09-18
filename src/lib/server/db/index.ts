import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrateDatabase } from './migrate';

let client: Database.Database;
if (env.DATABASE_URL && env.DATABASE_URL.length > 0) {
	client = new Database(env.DATABASE_URL);
} else {
	console.warn('DATABASE_URL not set — using in-memory SQLite database. Set DATABASE_URL to persist data.');
	client = new Database(':memory:');
}

// Run migrations using the same client before exporting db so tables exist for consumers
await migrateDatabase(client);

export const db = drizzle(client);
