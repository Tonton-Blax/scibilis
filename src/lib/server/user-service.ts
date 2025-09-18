import { eq, and, or, ilike } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hash, verify } from '@node-rs/argon2';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import fs from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';

const STORAGE_DIR = env.STORAGE_DIR || path.join(process.cwd(), 'storage');

function generateUserId() {
    // ID with 120 bits of entropy, or about the same as UUID v4.
    const bytes = crypto.getRandomValues(new Uint8Array(15));
    const id = encodeBase32LowerCase(bytes);
    return id;
}

export type UserWithDetails = typeof table.user.$inferSelect;

export async function getUserById(id: string): Promise<UserWithDetails | null> {
    const result = await db.select().from(table.user).where(eq(table.user.id, id));
    return result[0] || null;
}

export async function getUserByUsername(username: string): Promise<UserWithDetails | null> {
    const result = await db.select().from(table.user).where(eq(table.user.username, username));
    return result[0] || null;
}

export async function getUserByEmail(email: string): Promise<UserWithDetails | null> {
    const result = await db.select().from(table.user).where(eq(table.user.email, email));
    return result[0] || null;
}

export async function getAllUsers(limit = 50, offset = 0, search?: string): Promise<UserWithDetails[]> {
    if (search) {
        return db
            .select()
            .from(table.user)
            .where(
                or(
                    ilike(table.user.username, `%${search}%`),
                    ilike(table.user.name, `%${search}%`),
                    ilike(table.user.email, `%${search}%`)
                )
            )
            .limit(limit)
            .offset(offset);
    }
    
    return db.select().from(table.user).limit(limit).offset(offset);
}

export async function createUser(userData: {
    username: string;
    email?: string;
    name?: string;
    password: string;
    role?: 'user' | 'admin';
    bio?: string;
}): Promise<UserWithDetails> {
    const userId = generateUserId();
    const passwordHash = await hash(userData.password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
    });

    const newUser: typeof table.user.$inferInsert = {
        id: userId,
        username: userData.username,
        email: userData.email || null,
        name: userData.name || null,
        passwordHash,
        role: userData.role || 'user',
        bio: userData.bio || null,
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await db.insert(table.user).values(newUser).returning();
    return result[0];
}

export async function updateUser(
    id: string,
    userData: {
        username?: string;
        email?: string;
        name?: string;
        password?: string;
        role?: 'user' | 'admin';
        bio?: string;
        isActive?: boolean;
        emailVerified?: boolean;
    }
): Promise<UserWithDetails | null> {
    const updateData: Partial<typeof table.user.$inferInsert> = { ...userData };
    
    // If password is being updated, hash it
    if (userData.password) {
        updateData.passwordHash = await hash(userData.password, {
            memoryCost: 19456,
            timeCost: 2,
            outputLen: 32,
            parallelism: 1
        });
        // Remove password from updateData as it's been converted to passwordHash
        delete (updateData as any).password;
    }
    
    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    const result = await db
        .update(table.user)
        .set(updateData)
        .where(eq(table.user.id, id))
        .returning();
    
    return result[0] || null;
}

export async function createTrack(userId: string, fileName: string, filePath: string, title?: string, wasVideo = false) {
	try {
		const trackId = encodeBase32LowerCase(crypto.getRandomValues(new Uint8Array(15)));
		const newTrack: typeof table.track.$inferInsert = {
			id: trackId,
			userId,
			filePath,
			fileName,
			title: title || null,
			wasVideo,
			createdAt: new Date()
		};
		const result = await db.insert(table.track).values(newTrack).returning();
		const created = result[0];
		console.log(`[user-service] createTrack succeeded: userId=${userId} trackId=${created.id} filePath=${filePath}`);
		return created;
	} catch (err) {
		console.error('[user-service] createTrack failed:', err);
		throw err;
	}
}

export async function getTracksByUser(userId: string, limit = 50, offset = 0) {
    return db.select().from(table.track).where(eq(table.track.userId, userId)).limit(limit).offset(offset);
}

export async function createTranscription(trackId: string, content: string, withTimestamps = false) {
	try {
		const transId = encodeBase32LowerCase(crypto.getRandomValues(new Uint8Array(15)));
		const newTrans: typeof table.transcription.$inferInsert = {
			id: transId,
			trackId,
			content,
			withTimestamps,
			createdAt: new Date()
		};
		const result = await db.insert(table.transcription).values(newTrans).returning();
		const created = result[0];
		console.log(`[user-service] createTranscription succeeded: trackId=${trackId} transcriptionId=${created.id} withTimestamps=${withTimestamps}`);
		return created;
	} catch (err) {
		console.error('[user-service] createTranscription failed:', err);
		throw err;
	}
}

export async function getTranscriptionsByTrack(trackId: string) {
    return db.select().from(table.transcription).where(eq(table.transcription.trackId, trackId));
}

export async function deleteTrack(trackId: string, ownerId: string) {
    // ensure ownership
    const track = (await db.select().from(table.track).where(eq(table.track.id, trackId)))[0];
    if (!track) return false;
    if (track.userId !== ownerId) return false;

    // remove file
    try {
        const fullPath = path.join(STORAGE_DIR, track.filePath);
        await fs.rm(fullPath).catch(() => {});
    } catch {}

    // delete transcriptions
    await db.delete(table.transcription).where(eq(table.transcription.trackId, trackId));
    // delete track
    const res = await db.delete(table.track).where(eq(table.track.id, trackId));
    return res.changes > 0;
}

// Delete only user data (tracks + transcriptions + files), keep user row
export async function deleteUserData(userId: string) {
    const tracks = await db.select().from(table.track).where(eq(table.track.userId, userId));
    for (const t of tracks) {
        try { await fs.rm(path.join(STORAGE_DIR, t.filePath)).catch(() => {}); } catch {}
    }
    await db.delete(table.transcription).where(eq(table.transcription.trackId, table.track.id)).where(eq(table.track.userId, userId)).run?.();
    // simpler fallback: delete transcriptions where trackId in (select id from track where userId = ?)
    await db.execute(`DELETE FROM transcription WHERE trackId IN (SELECT id FROM track WHERE userId = ?)`, [userId]);
    await db.delete(table.track).where(eq(table.track.userId, userId));
}

// Update deleteUser to also remove files and related rows
export async function deleteUser(id: string): Promise<boolean> {
    // First, delete all sessions for this user
    await db.delete(table.session).where(eq(table.session.userId, id));
    
    // delete tracks files and related transcriptions
    const tracks = await db.select().from(table.track).where(eq(table.track.userId, id));
    for (const t of tracks) {
        try { await fs.rm(path.join(STORAGE_DIR, t.filePath)); } catch {}
    }
    await db.delete(table.transcription).where(eq(table.transcription.trackId, table.track.id)).where(eq(table.track.userId, id)).run?.();
    await db.execute(`DELETE FROM transcription WHERE trackId IN (SELECT id FROM track WHERE userId = ?)`, [id]);
    await db.delete(table.track).where(eq(table.track.userId, id));
    
    // Then delete the user
    const result = await db.delete(table.user).where(eq(table.user.id, id));
    return result.changes > 0;
}

export async function validateUserCredentials(
    username: string,
    password: string
): Promise<UserWithDetails | null> {
    const user = await getUserByUsername(username);
    if (!user) return null;

    const validPassword = await verify(user.passwordHash, password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
    });

    return validPassword ? user : null;
}

export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    if (excludeUserId) {
        const result = await db
            .select({ id: table.user.id })
            .from(table.user)
            .where(and(eq(table.user.username, username), eq(table.user.id, excludeUserId)));
        return result.length === 0;
    }
    
    const result = await db
        .select({ id: table.user.id })
        .from(table.user)
        .where(eq(table.user.username, username));
    return result.length === 0;
}

export async function isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    if (!email) return true;
    
    if (excludeUserId) {
        const result = await db
            .select({ id: table.user.id })
            .from(table.user)
            .where(and(eq(table.user.email, email), eq(table.user.id, excludeUserId)));
        return result.length === 0;
    }
    
    const result = await db
        .select({ id: table.user.id })
        .from(table.user)
        .where(eq(table.user.email, email));
    return result.length === 0;
}