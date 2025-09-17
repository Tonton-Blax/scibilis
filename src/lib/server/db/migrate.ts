import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = new Database(env.DATABASE_URL);

export async function migrateDatabase() {
    try {
        // Get table info to check which columns already exist
        const tableInfo = client.prepare("PRAGMA table_info(user)").all();
        const existingColumns = tableInfo.map((col: any) => col.name);
        
        // Add new columns to the user table if they don't exist (use camelCase to match Drizzle schema)
        if (!existingColumns.includes('email')) {
            client.exec(`ALTER TABLE user ADD COLUMN email TEXT;`);
        }
        
        if (!existingColumns.includes('name')) {
            client.exec(`ALTER TABLE user ADD COLUMN name TEXT;`);
        }
        
        if (!existingColumns.includes('avatar')) {
            client.exec(`ALTER TABLE user ADD COLUMN avatar TEXT;`);
        }
        
        if (!existingColumns.includes('age')) {
            client.exec(`ALTER TABLE user ADD COLUMN age INTEGER;`);
        }
        
        if (!existingColumns.includes('role')) {
            client.exec(`ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user';`);
        }
        
        // boolean fields: use camelCase column names expected by Drizzle
        if (!existingColumns.includes('isActive')) {
            client.exec(`ALTER TABLE user ADD COLUMN isActive INTEGER DEFAULT 1;`);
            // copy from legacy snake_case column if present
            if (existingColumns.includes('is_active')) {
                client.exec(`UPDATE user SET isActive = is_active WHERE isActive IS NULL;`);
            }
        }
        
        if (!existingColumns.includes('emailVerified')) {
            client.exec(`ALTER TABLE user ADD COLUMN emailVerified INTEGER DEFAULT 0;`);
            if (existingColumns.includes('email_verified')) {
                client.exec(`UPDATE user SET emailVerified = email_verified WHERE emailVerified IS NULL;`);
            }
        }
        
        if (!existingColumns.includes('bio')) {
            client.exec(`ALTER TABLE user ADD COLUMN bio TEXT;`);
        }
        
        if (!existingColumns.includes('createdAt')) {
            client.exec(`ALTER TABLE user ADD COLUMN createdAt INTEGER;`);
            // Set default value for existing rows using available legacy column if present
            const currentTime = Math.floor(Date.now() / 1000);
            if (existingColumns.includes('created_at')) {
                client.exec(`UPDATE user SET createdAt = created_at WHERE createdAt IS NULL;`);
            } else {
                client.exec(`UPDATE user SET createdAt = ${currentTime} WHERE createdAt IS NULL;`);
            }
        }
        
        if (!existingColumns.includes('updatedAt')) {
            client.exec(`ALTER TABLE user ADD COLUMN updatedAt INTEGER;`);
            const currentTime = Math.floor(Date.now() / 1000);
            if (existingColumns.includes('updated_at')) {
                client.exec(`UPDATE user SET updatedAt = updated_at WHERE updatedAt IS NULL;`);
            } else {
                client.exec(`UPDATE user SET updatedAt = ${currentTime} WHERE updatedAt IS NULL;`);
            }
        }
        
        // Create or migrate session table to have camelCase columns expected by Drizzle
        const sessionTableInfo = client.prepare("PRAGMA table_info(session)").all();
        const sessionColumns = sessionTableInfo.map((col: any) => col.name);
        // Detect legacy snake_case notnull property (if present)
        const legacyUserIdInfo = sessionTableInfo.find((c: any) => c.name === 'user_id');
        const legacyUserIdNotNull = legacyUserIdInfo ? Boolean(legacyUserIdInfo.notnull) : false;

        if (sessionTableInfo.length === 0) {
            // create with camelCase column names
            client.exec(`
                CREATE TABLE session (
                    id TEXT PRIMARY KEY,
                    userId TEXT NOT NULL,
                    expiresAt INTEGER NOT NULL,
                    FOREIGN KEY (userId) REFERENCES user(id)
                );
            `);
        } else {
            // If session exists but has legacy user_id with NOT NULL constraint, rebuild table so userId becomes canonical NOT NULL column
            if (legacyUserIdInfo && legacyUserIdNotNull) {
                client.exec('BEGIN TRANSACTION;');
                // create new table with userId NOT NULL and legacy user_id nullable
                client.exec(`
                    CREATE TABLE session_new (
                        id TEXT PRIMARY KEY,
                        userId TEXT NOT NULL,
                        user_id TEXT,
                        expiresAt INTEGER,
                        expires_at INTEGER,
                        FOREIGN KEY (userId) REFERENCES user(id)
                    );
                `);
                // copy data favoring existing userId but falling back to legacy user_id
                client.exec(`
                    INSERT INTO session_new (id, userId, user_id, expiresAt, expires_at)
                    SELECT
                        id,
                        COALESCE(userId, user_id) as userId,
                        user_id,
                        COALESCE(expiresAt, expires_at) as expiresAt,
                        expires_at
                    FROM session;
                `);
                client.exec(`DROP TABLE session;`);
                client.exec(`ALTER TABLE session_new RENAME TO session;`);
                client.exec('COMMIT;');
            } else {
                // If session exists but uses snake_case columns, add camelCase columns and copy values
                if (!sessionColumns.includes('userId')) {
                    client.exec(`ALTER TABLE session ADD COLUMN userId TEXT;`);
                    if (sessionColumns.includes('user_id')) {
                        client.exec(`UPDATE session SET userId = user_id WHERE userId IS NULL;`);
                    }
                }
                if (!sessionColumns.includes('expiresAt')) {
                    client.exec(`ALTER TABLE session ADD COLUMN expiresAt INTEGER;`);
                    if (sessionColumns.includes('expires_at')) {
                        client.exec(`UPDATE session SET expiresAt = expires_at WHERE expiresAt IS NULL;`);
                    }
                }
            }
        }

        // If legacy snake_case columns exist, add triggers to keep them in sync (avoid future NOT NULL failures)
        if (sessionColumns.includes('user_id') || sessionColumns.includes('expires_at')) {
            // drop triggers if they already exist to avoid duplicates
            try { client.exec(`DROP TRIGGER IF EXISTS sync_session_after_insert;`); } catch {}
            try { client.exec(`DROP TRIGGER IF EXISTS sync_session_after_update;`); } catch {}

            // After insert: populate legacy columns from camelCase values when they are NULL
            client.exec(`
                CREATE TRIGGER sync_session_after_insert
                AFTER INSERT ON session
                FOR EACH ROW
                WHEN (NEW.user_id IS NULL OR NEW.expires_at IS NULL)
                BEGIN
                    UPDATE session
                    SET
                        user_id = COALESCE(NEW.user_id, NEW.userId),
                        expires_at = COALESCE(NEW.expires_at, NEW.expiresAt)
                    WHERE id = NEW.id;
                END;
            `);

            // After update: keep legacy columns in sync if they are NULL
            client.exec(`
                CREATE TRIGGER sync_session_after_update
                AFTER UPDATE ON session
                FOR EACH ROW
                WHEN (NEW.user_id IS NULL OR NEW.expires_at IS NULL)
                BEGIN
                    UPDATE session
                    SET
                        user_id = COALESCE(NEW.user_id, NEW.userId),
                        expires_at = COALESCE(NEW.expires_at, NEW.expiresAt)
                    WHERE id = NEW.id;
                END;
            `);
        }

        console.log('Database migration completed successfully');
    } catch (error) {
        console.error('Database migration failed:', error);
        throw error;
    }
}