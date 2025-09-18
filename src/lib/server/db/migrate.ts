import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

export async function migrateDatabase(client?: Database.Database) {
	// If caller didn't provide a client, ensure DATABASE_URL exists and create one
	let localClient: Database.Database | undefined = client;
	if (!localClient) {
		if (!env.DATABASE_URL) {
			console.warn('DATABASE_URL not set — skipping migrations');
			return;
		}
		localClient = new Database(env.DATABASE_URL);
	}

	const STORAGE_DIR = env.STORAGE_DIR || path.join(process.cwd(), 'storage');

	function unlinkIfExists(p: string) {
		try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
	}

	try {
		// ensure storage dir
		if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

		// Create user table if it doesn't exist
		localClient.exec(`
			CREATE TABLE IF NOT EXISTS user (
				id TEXT PRIMARY KEY,
				username TEXT NOT NULL UNIQUE,
				email TEXT UNIQUE,
				password_hash TEXT NOT NULL,
				name TEXT,
				age INTEGER,
				avatar TEXT,
				bio TEXT,
				subscriber TEXT DEFAULT 'free',
				lastSeen INTEGER,
				role TEXT DEFAULT 'user' NOT NULL,
				isActive INTEGER DEFAULT 1 NOT NULL,
				emailVerified INTEGER DEFAULT 0 NOT NULL,
				createdAt INTEGER,
				updatedAt INTEGER
			);
		`);

		// Create session table if it doesn't exist
		localClient.exec(`
			CREATE TABLE IF NOT EXISTS session (
				id TEXT PRIMARY KEY,
				userId TEXT NOT NULL,
				expiresAt INTEGER NOT NULL,
				FOREIGN KEY (userId) REFERENCES user(id)
			);
		`);

		// Ensure track table exists
		localClient.exec(`
			CREATE TABLE IF NOT EXISTS track (
				id TEXT PRIMARY KEY,
				userId TEXT NOT NULL,
				filePath TEXT NOT NULL,
				fileName TEXT NOT NULL,
				title TEXT,
				wasVideo INTEGER DEFAULT 0,
				createdAt INTEGER,
				FOREIGN KEY (userId) REFERENCES user(id)
			);
		`);

		// Ensure transcription table exists
		localClient.exec(`
			CREATE TABLE IF NOT EXISTS transcription (
				id TEXT PRIMARY KEY,
				trackId TEXT NOT NULL,
				content TEXT NOT NULL,
				withTimestamps INTEGER DEFAULT 0,
				createdAt INTEGER,
				FOREIGN KEY (trackId) REFERENCES track(id)
			);
		`);

		// Now read current user table columns and add any missing columns (upgrade path)
		const tableInfo = localClient.prepare("PRAGMA table_info(user)").all();
		const existingColumns = tableInfo.map((col: any) => col.name);

		if (!existingColumns.includes('email')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN email TEXT;`);
		}
		if (!existingColumns.includes('name')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN name TEXT;`);
		}
		if (!existingColumns.includes('avatar')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN avatar TEXT;`);
		}
		if (!existingColumns.includes('age')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN age INTEGER;`);
		}
		if (!existingColumns.includes('role')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user';`);
		}
		if (!existingColumns.includes('isActive')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN isActive INTEGER DEFAULT 1;`);
		}
		if (!existingColumns.includes('emailVerified')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN emailVerified INTEGER DEFAULT 0;`);
		}
		if (!existingColumns.includes('bio')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN bio TEXT;`);
		}
		if (!existingColumns.includes('createdAt')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN createdAt INTEGER;`);
			const currentTime = Math.floor(Date.now() / 1000);
			if (existingColumns.includes('created_at')) {
				localClient.exec(`UPDATE user SET createdAt = created_at WHERE createdAt IS NULL;`);
			} else {
				localClient.exec(`UPDATE user SET createdAt = ${currentTime} WHERE createdAt IS NULL;`);
			}
		}
		if (!existingColumns.includes('updatedAt')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN updatedAt INTEGER;`);
			const currentTime = Math.floor(Date.now() / 1000);
			if (existingColumns.includes('updated_at')) {
				localClient.exec(`UPDATE user SET updatedAt = updated_at WHERE updatedAt IS NULL;`);
			} else {
				localClient.exec(`UPDATE user SET updatedAt = ${currentTime} WHERE updatedAt IS NULL;`);
			}
		}
		// Add subscriber and lastSeen if missing
		if (!existingColumns.includes('subscriber')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN subscriber TEXT DEFAULT 'free';`);
		}
		if (!existingColumns.includes('lastSeen')) {
			localClient.exec(`ALTER TABLE user ADD COLUMN lastSeen INTEGER;`);
			const currentTime = Math.floor(Date.now() / 1000);
			localClient.exec(`UPDATE user SET lastSeen = ${currentTime} WHERE lastSeen IS NULL;`);
		}

		// Run cleanup for free users:
		const now = Date.now();
		const days7 = now - 1000 * 60 * 60 * 24 * 7;
		const days60 = now - 1000 * 60 * 60 * 24 * 60;

		const freeUsers = localClient.prepare(`SELECT id, lastSeen FROM user WHERE subscriber = 'free'`).all();
		for (const u of freeUsers) {
			const lastSeenVal = u.lastSeen;
			// lastSeen stored as seconds or integer — normalize to ms
			const lastSeenMs = lastSeenVal ? (Number(lastSeenVal) > 1e12 ? Number(lastSeenVal) : Number(lastSeenVal) * 1000) : 0;
			if (!lastSeenMs) continue;
			if (lastSeenMs <= days60) {
				const tracks = localClient.prepare(`SELECT filePath FROM track WHERE userId = ?`).all(u.id);
				for (const t of tracks) unlinkIfExists(path.join(STORAGE_DIR, t.filePath));
				localClient.exec(`DELETE FROM transcription WHERE trackId IN (SELECT id FROM track WHERE userId = '${u.id}');`);
				localClient.exec(`DELETE FROM track WHERE userId = '${u.id}';`);
				localClient.exec(`DELETE FROM session WHERE userId = '${u.id}';`);
				localClient.exec(`DELETE FROM user WHERE id = '${u.id}';`);
			} else if (lastSeenMs <= days7) {
				const tracks = localClient.prepare(`SELECT filePath FROM track WHERE userId = ?`).all(u.id);
				for (const t of tracks) unlinkIfExists(path.join(STORAGE_DIR, t.filePath));
				localClient.exec(`DELETE FROM transcription WHERE trackId IN (SELECT id FROM track WHERE userId = '${u.id}');`);
				localClient.exec(`DELETE FROM track WHERE userId = '${u.id}';`);
			}
		}

		console.log('Database migration completed successfully');
	} catch (error) {
		console.error('Database migration failed:', error);
		throw error;
	} finally {
		// If migrateDatabase created its own client, close it
		if (!client && localClient) {
			try { localClient.close(); } catch {}
		}
	}
}